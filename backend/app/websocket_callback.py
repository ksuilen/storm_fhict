import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import WebSocket
import logging

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


class WebSocketCallbackHandler(BaseCallbackHandler):
    """STORM callback handler that sends real-time updates via WebSocket"""
    
    def __init__(self, websocket_manager: WebSocketManager, run_id: str):
        super().__init__()
        self.ws_manager = websocket_manager
        self.run_id = run_id
        self.current_phase = "starting"
        self.progress = 0
        self.dialogue_count = 0
        self.total_sources = 0
        
    def _send_update(self, status: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Send a status update via WebSocket"""
        update = {
            "run_id": self.run_id,
            "phase": self.current_phase,
            "status": status,
            "message": message,
            "progress": self.progress,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        
        # Use asyncio to send the update (will be handled by the event loop)
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(self.ws_manager.broadcast_to_run(self.run_id, update))
        except RuntimeError:
            # If no event loop is running, we can't send the update
            logger.warning(f"No event loop available to send WebSocket update for run {self.run_id}")
    
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
            f"💡 Research question {self.dialogue_count}: {dlg_turn.user_utterance[:50]}{'...' if len(dlg_turn.user_utterance) > 50 else ''}",
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


# Global WebSocket manager instance
websocket_manager = WebSocketManager() 