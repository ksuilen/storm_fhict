from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Union

from app import crud, schemas, models
from app.database import get_db
from app.core.auth import get_current_active_admin, get_current_actor, get_current_actor_or_inactive_for_history

router = APIRouter()

@router.post("/", response_model=schemas.VoucherDisplay, status_code=status.HTTP_201_CREATED)
def create_voucher(
    *, 
    db: Session = Depends(get_db),
    voucher_in: schemas.VoucherCreate,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Create new voucher. (Admin only)
    """
    voucher = crud.create_voucher(db=db, voucher_in=voucher_in, admin_id=current_admin.id)
    # Bereken remaining_runs voor display
    display_voucher = schemas.VoucherDisplay.model_validate(voucher)
    display_voucher.remaining_runs = voucher.max_runs - voucher.used_runs
    return display_voucher


@router.post("/batch", response_model=List[schemas.VoucherDisplay], status_code=status.HTTP_201_CREATED)
def create_voucher_batch(
    *,
    db: Session = Depends(get_db),
    batch_in: schemas.VoucherBatchCreate,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Create a batch of vouchers. (Admin only)
    """
    vouchers = crud.create_voucher_batch(db=db, batch_in=batch_in, admin_id=current_admin.id)
    display_vouchers = []
    for v in vouchers:
        dv = schemas.VoucherDisplay.model_validate(v)
        dv.remaining_runs = v.max_runs - v.used_runs
        display_vouchers.append(dv)
    return display_vouchers

@router.get("/", response_model=List[schemas.VoucherDisplay])
def read_vouchers(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Retrieve all vouchers. (Admin only)
    """
    vouchers = crud.get_all_vouchers(db, skip=skip, limit=limit)
    display_vouchers = []
    for v in vouchers:
        dv = schemas.VoucherDisplay.model_validate(v)
        dv.remaining_runs = v.max_runs - v.used_runs
        display_vouchers.append(dv)
    return display_vouchers

@router.get("/{voucher_id}", response_model=schemas.VoucherDisplay)
def read_voucher(
    *, 
    db: Session = Depends(get_db),
    voucher_id: int,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Get voucher by ID. (Admin only)
    """
    voucher = crud.get_voucher(db, voucher_id=voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    display_voucher = schemas.VoucherDisplay.model_validate(voucher)
    display_voucher.remaining_runs = voucher.max_runs - voucher.used_runs
    return display_voucher

@router.put("/{voucher_id}", response_model=schemas.VoucherDisplay)
def update_voucher(
    *, 
    db: Session = Depends(get_db),
    voucher_id: int,
    voucher_in: schemas.VoucherUpdate,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Update a voucher. (Admin only)
    """
    db_voucher = crud.get_voucher(db, voucher_id=voucher_id)
    if not db_voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    voucher = crud.update_voucher(db=db, db_voucher=db_voucher, voucher_in=voucher_in)
    display_voucher = schemas.VoucherDisplay.model_validate(voucher)
    display_voucher.remaining_runs = voucher.max_runs - voucher.used_runs
    return display_voucher

@router.delete("/{voucher_id}", response_model=schemas.VoucherDisplay) # Of schemas.Msg of gewoon status 204
def delete_voucher(
    *, 
    db: Session = Depends(get_db),
    voucher_id: int,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Delete a voucher. (Admin only)
    """
    voucher = crud.delete_voucher(db=db, voucher_id=voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    # Om consistent te zijn, return het object dat verwijderd is, of een confirmatie bericht
    display_voucher = schemas.VoucherDisplay.model_validate(voucher)
    display_voucher.remaining_runs = voucher.max_runs - voucher.used_runs # Zal vaak max_runs zijn, of afh. van state
    return display_voucher

@router.delete("/", response_model=schemas.Msg)
def bulk_delete_vouchers_by_ids(
    *,
    db: Session = Depends(get_db),
    ids: str,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Bulk delete vouchers by comma-separated ids. (Admin only)
    """
    try:
        id_list = [int(x) for x in ids.split(',') if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ids parameter")
    deleted = crud.delete_vouchers_by_ids(db=db, ids=id_list)
    return schemas.Msg(message=f"Deleted {deleted} vouchers")

@router.delete("/by-batch/{batch_label}", response_model=schemas.Msg)
def bulk_delete_vouchers_by_batch(
    *,
    db: Session = Depends(get_db),
    batch_label: str,
    current_admin: models.User = Depends(get_current_active_admin)
) -> Any:
    """
    Bulk delete vouchers by batch_label. (Admin only)
    """
    deleted = crud.delete_vouchers_by_batch_label(db=db, batch_label=batch_label)
    return schemas.Msg(message=f"Deleted {deleted} vouchers in batch '{batch_label}'")

# Nieuwe endpoint voor voucher-houder om eigen details op te halen
@router.get("/me/details", response_model=schemas.VoucherDisplay)
async def read_voucher_me_details(
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history),
    db: Session = Depends(get_db) # db session is nodig als we extra info zouden willen laden
) -> Any:
    """
    Get current voucher's details.
    """
    if not isinstance(current_actor, models.Voucher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a voucher actor. Access denied."
        )
    
    # current_actor is al het models.Voucher object, gehaald en gevalideerd door get_current_actor
    # We moeten het alleen nog converteren naar het display schema
    # Het CRUD get_voucher is niet nodig, tenzij we de db willen hitten voor de allerlaatste versie
    # Echter, get_current_actor zou de voucher uit de db moeten halen op basis van de token.
    # Laten we voor nu aannemen dat current_actor up-to-date is.
    # Als we zeker willen zijn, kunnen we hier crud.get_voucher(db, current_actor.id) doen.
    
    # Converteer naar VoucherDisplay schema
    # We gebruiken model_validate (Pydantic v2) of from_orm als VoucherDisplay een Config met from_attributes heeft.
    # VoucherDisplay erft van VoucherInDBBase, die from_attributes=True heeft.
    display_voucher = schemas.VoucherDisplay.model_validate(current_actor)
    display_voucher.remaining_runs = current_actor.max_runs - current_actor.used_runs
    return display_voucher 