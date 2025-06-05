from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB # Als je PostgreSQL gebruikt en JSONB wilt
from sqlalchemy.sql import func
import enum
from app.database import Base # CORRECTED IMPORT
# Verwijder de directe import van User als we de ForeignKey aanpassen
# from app.models.user import User 

class StormRunStatus(enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    # Voeg eventueel andere statussen toe

class StormRun(Base):
    __tablename__ = "storm_runs"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True, nullable=False)
    
    # Vervang user_id met owner_type en owner_id
    # user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # user: Mapped["User"] = relationship(back_populates="runs")
    owner_type = Column(String, nullable=False) # Kan 'admin' of 'voucher' zijn
    owner_id = Column(Integer, nullable=False) # Verwijst naar User.id of Voucher.id

    status = Column(SAEnum(StormRunStatus), default=StormRunStatus.pending, nullable=False)
    current_stage = Column(String, nullable=True) # Bv. 'INITIALIZING', 'GENERATING_OUTLINE' etc.
    error_message = Column(Text, nullable=True) # Uitgebreidere foutmelding

    # Configuratie details van de run (optioneel)
    # config_details = Column(JSONB, nullable=True) # Voorbeeld als je JSONB wilt gebruiken

    output_dir = Column(String, nullable=True) # Pad naar output bestanden
    
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

    # Relationship to progress updates
    progress_updates = relationship("StormProgressUpdate", back_populates="run", cascade="all, delete-orphan")

    # Je zou hier nog steeds een relatie kunnen definiëren als je een geavanceerde
    # polymorfische relatie opzet, maar voor nu houden we het simpel.
    # Voorbeeld van hoe je dat zou kunnen benaderen met een discriminator:
    # owner = relationship(
    #     lambda: User if StormRun.owner_type == 'admin' else Voucher, 
    #     foreign_keys=[owner_id],
    #     primaryjoin=lambda: and_(
    #         owner_id == remote(User.id if StormRun.owner_type == 'admin' else Voucher.id),
    #         # Je hebt een manier nodig om te switchen tussen User.id en Voucher.id in de join
    #     )
    # )
    # Dit is complex en vaak is het makkelijker dit in de applicatielogica af te handelen.

    def __repr__(self):
        return f"<StormRun(id={self.id}, topic='{self.topic}', owner_type='{self.owner_type}', owner_id={self.owner_id}, status='{self.status}')>" 