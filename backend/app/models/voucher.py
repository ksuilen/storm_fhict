from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from .user import User # Voor de ForeignKey naar de admin die het aanmaakt

class Voucher(Base):
    __tablename__ = "vouchers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    prefix = Column(String, nullable=True) # Door admin opgegeven, kan deel van 'code' zijn of apart
    
    max_runs = Column(Integer, nullable=False, default=1)
    used_runs = Column(Integer, nullable=False, default=0)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Optioneel wie het heeft aangemaakt
    creator = relationship("User") # Relatie naar de User tabel (admins)

    def __repr__(self):
        return f"<Voucher(code='{self.code}', prefix='{self.prefix}', max_runs={self.max_runs}, used_runs={self.used_runs}, is_active={self.is_active})>" 