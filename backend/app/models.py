from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func 

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    storm_runs = relationship("StormRun", back_populates="owner")

    # Je kunt hier later relaties toevoegen, bv. naar opgeslagen Storm queries 

class StormRun(Base):
    __tablename__ = "storm_runs"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    status = Column(String, default="pending")
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    output_dir = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="storm_runs") 