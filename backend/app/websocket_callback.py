import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import WebSocket
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

# Import STORM's callback system
import sys
from pathlib import Path
STORM_PATH = Path(__file__).parent / "external/storm"
if str(STORM_PATH) not in sys.path:
    sys.path.insert(0, str(STORM_PATH))

from knowledge_storm.storm_wiki.modules.callback import BaseCallbackHandler

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time STORM updates"""
    
    def __init__(self):
        # Dictionary to store active connections by run_id
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._loop = None
        self._executor = ThreadPoolExecutor(max_workers=2)
        
    def set_event_loop(self, loop):
        """Set the main event loop reference for thread-safe operations"""
        self._loop = loop
    
    async def connect(self, websocket: WebSocket, run_id: str):
        """Connect a WebSocket for a specific STORM run"""
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)
        logger.info(f"WebSocket connected for run_id: {run_id}")
    
    def disconnect(self, websocket: WebSocket, run_id: str):
        """Disconnect a WebSocket"""
        if run_id in self.active_connections:
            if websocket in self.active_connections[run_id]:
                self.active_connections[run_id].remove(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]
        logger.info(f"WebSocket disconnected for run_id: {run_id}")
    
    async def broadcast_to_run(self, run_id: str, message: Dict[str, Any]):
        """Broadcast a message to all WebSockets connected to a specific run"""
        if run_id not in self.active_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for websocket in self.active_connections[run_id]:
            try:
                await websocket.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                disconnected.append(websocket)
        
        # Remove disconnected WebSockets
        for ws in disconnected:
            self.disconnect(ws, run_id)
    
    def broadcast_from_thread(self, run_id: str, message: Dict[str, Any]):
        """Thread-safe method to broadcast from background threads"""
        if self._loop is None:
            logger.warning(f"No event loop set for WebSocket manager, cannot send update for run {run_id}")
            return
            
        try:
            # Schedule the coroutine in the main event loop from this thread
            future = asyncio.run_coroutine_threadsafe(
                self.broadcast_to_run(run_id, message), 
                self._loop
            )
            # Don't wait for completion to avoid blocking the background thread
            logger.debug(f"Scheduled WebSocket broadcast for run {run_id}")
        except Exception as e:
            logger.error(f"Error scheduling WebSocket broadcast for run {run_id}: {e}")


class WebSocketCallbackHandler(BaseCallbackHandler):
    """STORM callback handler that sends real-time updates via WebSocket"""
    
    def __init__(self, websocket_manager: WebSocketManager, run_id: str, db_session: Session = None):
        super().__init__()
        self.ws_manager = websocket_manager
        self.run_id = run_id
        self.db_session = db_session
        self.current_phase = "starting"
        self.progress = 0
        self.dialogue_count = 0
        self.total_sources = 0
        self.progress_updates = []  # Store updates for batch saving at completion
        
    def _send_update(self, status: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Send a status update via WebSocket (thread-safe)"""
        timestamp = datetime.now()
        update = {
            "run_id": self.run_id,
            "phase": self.current_phase,
            "status": status,
            "message": message,
            "progress": self.progress,
            "timestamp": timestamp.isoformat(),
            "details": details or {}
        }
        
        # Store update for later database saving
        self.progress_updates.append({
            "timestamp": timestamp,
            "phase": self.current_phase,
            "status": status,
            "message": message,
            "progress": self.progress,
            "details": details or {}
        })
        
        # Use thread-safe broadcast method
        try:
            self.ws_manager.broadcast_from_thread(self.run_id, update)
            logger.debug(f"Sent WebSocket update for run {self.run_id}: {message}")
        except Exception as e:
            logger.error(f"Error sending WebSocket update for run {self.run_id}: {e}")
    
    def _save_progress_to_database(self):
        """Save all collected progress updates to database (called at completion)"""
        if not self.db_session or not self.progress_updates:
            logger.warning(f"Cannot save progress to database for run {self.run_id}: no db_session or no updates")
            return
            
        try:
            from . import crud
            
            # Save all progress updates to database
            for update in self.progress_updates:
                crud.create_progress_update(
                    self.db_session,
                    run_id=int(self.run_id),
                    timestamp=update["timestamp"],
                    phase=update["phase"],
                    status=update["status"],
                    message=update["message"],
                    progress=update["progress"],
                    details=update["details"]
                )
            
            logger.info(f"Saved {len(self.progress_updates)} progress updates to database for run {self.run_id}")
            
        except Exception as e:
            logger.error(f"Error saving progress updates to database for run {self.run_id}: {e}")
            # Don't raise the exception to avoid breaking the STORM process
    
    # Research Phase Callbacks
    def on_identify_perspective_start(self, **kwargs):
        """Called when perspective identification starts"""
        self.current_phase = "research_planning"
        self.progress = 5
        self._send_update(
            "info", 
            "🔍 Identifying research perspectives...",
            {"step": "perspective_identification"}
        )
    
    def on_identify_perspective_end(self, perspectives: List[str], **kwargs):
        """Called when perspective identification ends"""
        self.progress = 10
        self._send_update(
            "success", 
            f"✅ Identified {len(perspectives)} research perspectives",
            {
                "step": "perspective_identification_complete",
                "perspectives": perspectives,
                "perspective_count": len(perspectives)
            }
        )
    
    def on_information_gathering_start(self, **kwargs):
        """Called when information gathering starts"""
        self.current_phase = "research_execution"
        self.progress = 15
        self._send_update(
            "info", 
            "🌐 Starting web research...",
            {"step": "information_gathering_start"}
        )
    
    def on_dialogue_turn_end(self, dlg_turn, **kwargs):
        """Called after each dialogue turn (question-answer cycle)"""
        self.dialogue_count += 1
        self.progress = min(15 + (self.dialogue_count * 5), 60)
        
        # Extract information from dialogue turn
        urls = list(set([r.url for r in dlg_turn.search_results]))
        self.total_sources += len(urls)
        
        # Create research insight
        research_insight = {
            "step": "dialogue_turn_complete",
            "dialogue_number": self.dialogue_count,
            "question": dlg_turn.user_utterance,
            "answer_preview": dlg_turn.agent_utterance[:150] + "..." if len(dlg_turn.agent_utterance) > 150 else dlg_turn.agent_utterance,
            "sources_found": len(urls),
            "search_queries": dlg_turn.search_queries,
            "top_sources": [
                {
                    "url": url,
                    "domain": url.split('/')[2] if len(url.split('/')) > 2 else url
                }
                for url in urls[:3]
            ],
            "total_sources_so_far": self.total_sources
        }
        
        self._send_update(
            "info",
            f"💡 Research question {self.dialogue_count}: {dlg_turn.user_utterance[:200]}{'...' if len(dlg_turn.user_utterance) > 200 else ''}",
            research_insight
        )
    
    def on_information_gathering_end(self, **kwargs):
        """Called when information gathering ends"""
        self.progress = 65
        self._send_update(
            "success", 
            f"✅ Research completed - {self.dialogue_count} questions asked, {self.total_sources} sources consulted",
            {
                "step": "information_gathering_complete",
                "total_dialogues": self.dialogue_count,
                "total_sources": self.total_sources
            }
        )
    
    # Outline Generation Phase Callbacks
    def on_information_organization_start(self, **kwargs):
        """Called when information organization starts"""
        self.current_phase = "outline_generation"
        self.progress = 70
        self._send_update(
            "info", 
            "📋 Organizing information into outline...",
            {"step": "outline_generation_start"}
        )
    
    def on_direct_outline_generation_end(self, outline: str, **kwargs):
        """Called when direct outline generation ends"""
        self.progress = 80
        sections = outline.count('#')
        self._send_update(
            "info",
            f"📝 Generated initial outline with {sections} sections",
            {
                "step": "direct_outline_complete",
                "section_count": sections,
                "outline_preview": outline[:200] + "..." if len(outline) > 200 else outline
            }
        )
    
    def on_outline_refinement_end(self, outline: str, **kwargs):
        """Called when outline refinement ends"""
        self.progress = 90
        sections = outline.count('#')
        subsections = outline.count('##') - outline.count('###')
        
        self._send_update(
            "success",
            f"✅ Refined outline completed - {sections} sections, {subsections} subsections",
            {
                "step": "outline_refinement_complete",
                "section_count": sections,
                "subsection_count": subsections,
                "outline_preview": outline[:300] + "..." if len(outline) > 300 else outline
            }
        )
    
    # Article Generation Phase (custom methods)
    def on_article_generation_start(self):
        """Custom method for article generation start"""
        self.current_phase = "article_generation"
        self.progress = 92
        self._send_update(
            "info",
            "✍️ Generating article content...",
            {"step": "article_generation_start"}
        )
    
    def on_article_generation_end(self):
        """Custom method for article generation end"""
        self.progress = 95
        self._send_update(
            "success",
            "✅ Article generation completed",
            {"step": "article_generation_complete"}
        )
    
    def on_article_polish_start(self):
        """Custom method for article polishing start"""
        self.progress = 96
        self._send_update(
            "info",
            "✨ Polishing article...",
            {"step": "article_polish_start"}
        )
    
    def on_article_polish_end(self):
        """Custom method for article polishing end"""
        self.progress = 98
        self._send_update(
            "success",
            "✅ Article polishing completed",
            {"step": "article_polish_complete"}
        )
    
    def on_storm_complete(self):
        """Custom method for when entire STORM process is complete"""
        self.current_phase = "completed"
        self.progress = 100
        self._send_update(
            "success",
            "🎉 STORM article generation completed successfully!",
            {
                "step": "storm_complete",
                "summary": {
                    "total_dialogues": self.dialogue_count,
                    "total_sources": self.total_sources,
                    "phases_completed": ["research_planning", "research_execution", "outline_generation", "article_generation"]
                }
            }
        )
        self._save_progress_to_database()

    # ------------------------------------------------------------------
    # STORM Callback Overrides to emit finer-grained progress updates
    # ------------------------------------------------------------------
    def on_turn_policy_planning_start(self, **kwargs):
        self.current_phase = "turn_planning"
        self._send_update("info", "Turn policy planning started")

    def on_expert_action_planning_start(self, **kwargs):
        self.current_phase = "expert_action_planning"
        self._send_update("info", "Expert action planning started")

    def on_expert_action_planning_end(self, **kwargs):
        self.progress += 5
        self._send_update("info", "Expert action planning finished")

    def on_expert_information_collection_start(self, **kwargs):
        self.current_phase = "info_collection"
        self._send_update("info", "Information collection started")

    def on_expert_information_collection_end(self, info, **kwargs):
        self.progress += 10
        self._send_update("info", f"Information collection finished – collected {len(info)} items", {"items": len(info)})

    def on_expert_utterance_generation_end(self, **kwargs):
        self.progress += 10
        self._send_update("info", "Expert utterance generation finished")

    def on_expert_utterance_polishing_start(self, **kwargs):
        self.current_phase = "utterance_polishing"
        self._send_update("info", "Polishing expert utterances")

    def on_mindmap_insert_start(self, **kwargs):
        self.current_phase = "mindmap_insert"
        self._send_update("info", "Inserting info into mind-map")

    def on_mindmap_insert_end(self, **kwargs):
        self.progress += 5
        self._send_update("info", "Mind-map insert finished")

    def on_mindmap_reorg_start(self, **kwargs):
        self.current_phase = "mindmap_reorg"
        self._send_update("info", "Re-organising mind-map")

    def on_mindmap_reorg_end(self, **kwargs):
        self.progress += 5
        self._send_update("info", "Mind-map reorg finished")


# Global WebSocket manager instance
websocket_manager = WebSocketManager() 