#!/usr/bin/env python3
"""
Script om admin wachtwoord te wijzigen in de Storm WebApp database
Gebruik: python change_admin_password.py
"""

import sys
import os
from getpass import getpass

# Voeg het app pad toe aan Python path
sys.path.insert(0, '/app')

# Import app modules
from app.database import SessionLocal
from app import models, crud
from app.core.security import get_password_hash

def change_admin_password():
    """Wijzig het wachtwoord van een admin user op basis van email"""
    
    # Email van de admin
    admin_email = "k.suilen@fontys.nl"
    
    # Vraag om nieuw wachtwoord
    print(f"Wachtwoord wijzigen voor admin: {admin_email}")
    print("-" * 50)
    
    new_password = getpass("Nieuw wachtwoord: ")
    if len(new_password) < 6:
        print("❌ Wachtwoord moet minimaal 6 karakters lang zijn")
        return False
    
    confirm_password = getpass("Bevestig wachtwoord: ")
    if new_password != confirm_password:
        print("❌ Wachtwoorden komen niet overeen")
        return False
    
    # Database sessie
    db = SessionLocal()
    
    try:
        # Zoek de admin user
        admin_user = crud.get_user_by_email(db, email=admin_email)
        
        if not admin_user:
            print(f"❌ Geen user gevonden met email: {admin_email}")
            return False
        
        if admin_user.role != "admin":
            print(f"❌ User {admin_email} is geen admin (role: {admin_user.role})")
            return False
        
        # Hash het nieuwe wachtwoord
        hashed_password = get_password_hash(new_password)
        
        # Update de user
        admin_user.hashed_password = hashed_password
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"✅ Wachtwoord succesvol gewijzigd voor admin: {admin_email}")
        print(f"   User ID: {admin_user.id}")
        print(f"   Role: {admin_user.role}")
        return True
        
    except Exception as e:
        print(f"❌ Fout bij wijzigen wachtwoord: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()

def list_admin_users():
    """Toon alle admin users in de database"""
    print("\n🔍 Alle admin users:")
    print("-" * 50)
    
    db = SessionLocal()
    try:
        admin_users = crud.get_users(db, only_admins=True, limit=100)
        
        if not admin_users:
            print("Geen admin users gevonden")
            return
        
        for user in admin_users:
            print(f"  • ID: {user.id}, Email: {user.email}, Role: {user.role}")
            
    except Exception as e:
        print(f"❌ Fout bij ophalen admin users: {e}")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔐 Storm WebApp - Admin Wachtwoord Manager")
    print("=" * 50)
    
    # Toon eerst alle admin users
    list_admin_users()
    
    # Vraag om bevestiging
    print(f"\n⚠️  Je gaat het wachtwoord wijzigen voor: k.suilen@fontys.nl")
    confirm = input("Doorgaan? (y/N): ").lower().strip()
    
    if confirm in ['y', 'yes', 'ja', 'j']:
        success = change_admin_password()
        if success:
            print("\n🎉 Klaar! Je kunt nu inloggen met het nieuwe wachtwoord.")
        else:
            print("\n💥 Er is iets misgegaan. Check de error messages hierboven.")
            sys.exit(1)
    else:
        print("❌ Operatie geannuleerd.")
        sys.exit(0) 