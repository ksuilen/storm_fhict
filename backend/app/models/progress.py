from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class StormProgressUpdate(Base):
    __tablename__ = "storm_progress_updates"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("storm_runs.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    phase = Column(String, nullable=False)  # research_planning, research_execution, etc.
    status = Column(String, nullable=False)  # info, success, warning, error
    message = Column(Text, nullable=False)  # detailed status message
    progress = Column(Integer, nullable=False, default=0)  # 0-100 percentage
    details = Column(JSON, nullable=True)  # structured data like sources, perspectives, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to StormRun
    run = relationship("StormRun", back_populates="progress_updates")

    def __repr__(self):
        return f"<StormProgressUpdate(id={self.id}, run_id={self.run_id}, phase='{self.phase}', progress={self.progress})>" 