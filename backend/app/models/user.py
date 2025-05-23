from sqlalchemy import Boolean, Column, Integer, String
# from sqlalchemy.orm import relationship # Voorlopig niet nodig

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="user", nullable=False) # Essentieel voor admin roles

    # De storm_runs relatie is complexer geworden door owner_type/owner_id in StormRun.
    # Voor nu laten we een directe SQLAlchemy relationship hier weg om circular imports
    # en complexiteit te vermijden. Queries kunnen de runs nog steeds vinden via owner_id en owner_type.
    # storm_runs = relationship("StormRun", back_populates="owner") # Verwijderd/uitgecommentarieerd

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', is_active={self.is_active})>" 