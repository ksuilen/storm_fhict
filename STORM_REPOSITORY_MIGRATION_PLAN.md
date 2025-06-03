# STORM Repository Migration Plan

## Overzicht
Migratie van `knowledge_storm` pip package naar Stanford STORM repository voor diepere aanpassingen en controle.

**Huidige Status:** 🟡 In Progress - Fase 1  
**Start Datum:** 26 Mei 2025  
**Target Datum:** 23 Juni 2025  

---

## 🔄 GIT WORKFLOW STRATEGIE BESLISSING

### Huidige Situatie
- ✅ Stanford STORM toegevoegd als git submodule in `backend/external/storm`
- ✅ Submodule werkt en imports zijn succesvol
- ❓ **Beslissing nodig:** Behouden als submodule of converteren naar direct copy?

### Optie A: Git Submodule (Huidige Setup)
**Voordelen:**
- ✅ Kan syncen met Stanford updates via `git pull upstream`
- ✅ Duidelijke scheiding tussen jouw code en Stanford code
- ✅ Kleinere repository size (alleen commit references)

**Nadelen:**
- ❌ Complexere git workflow (submodule commands)
- ❌ Merge conflicts bij Stanford updates
- ❌ Docker deployment complexiteit (git submodule init)
- ❌ Twee aparte git histories om te beheren

**Workflow voor wijzigingen:**
```bash
# Wijzigingen in STORM
cd backend/external/storm
git add . && git commit -m "Custom STORM modifications"
git push origin main  # Naar jouw fork

# Update hoofdproject
cd ../../..
git add backend/external/storm
git commit -m "Update STORM submodule"

# Sync met Stanford (periodiek)
cd backend/external/storm
git fetch upstream
git merge upstream/main
```

### Optie B: Direct Copy (Aanbevolen voor veel customization)
**Voordelen:**
- ✅ Eenvoudige git workflow - alles in één repository
- ✅ Makkelijker Docker deployment
- ✅ Volledige controle over alle code
- ✅ Geen submodule complexiteit

**Nadelen:**
- ❌ Handmatig proces voor Stanford updates
- ❌ Grotere repository size
- ❌ Moeilijker om upstream changes te tracken

**Conversie stappen:**
```bash
# 1. Backup huidige staat
git add -A && git commit -m "Backup before submodule conversion"

# 2. Verwijder submodule configuratie
git submodule deinit backend/external/storm
git rm backend/external/storm
rm -rf .git/modules/backend/external/storm

# 3. Kopieer STORM source direct
# (STORM code blijft in backend/external/storm maar zonder .git)
cd backend/external/storm
rm -rf .git
cd ../../..

# 4. Add als normale project files
git add backend/external/storm
git commit -m "Convert STORM from submodule to direct source copy"

# 5. Tag Stanford baseline voor referentie
git tag stanford-storm-baseline-$(date +%Y%m%d)
```

**Sync strategie voor Direct Copy:**
```bash
# Periodieke Stanford updates (handmatig)
cd /tmp
git clone https://github.com/stanford-oval/storm.git stanford-storm-latest
cd /Users/koen/Development/storm_webapp/storm_webapp

# Vergelijk en merge selectief
diff -r backend/external/storm /tmp/stanford-storm-latest
# Of gebruik merge tool voor specifieke files
```

### 🎯 AANBEVELING: Optie B (Direct Copy)

**Rationale voor jouw project:**
1. **Veel customization verwacht** - Direct access is makkelijker
2. **Deployment eenvoud** - Geen git submodule init in Docker
3. **Development focus** - Meer tijd aan features, minder aan git management
4. **Controlled updates** - Selectief Stanford features overnemen

### 📋 ACTIE ITEMS VOOR CONVERSIE
- [ ] **Beslissing:** Akkoord met Optie B (Direct Copy)?
- [ ] **Timing:** Wanneer conversie uitvoeren? (Voor/na Phase 3?)
- [ ] **Backup:** Extra backup maken voor conversie
- [ ] **Testing:** Verificatie dat alles nog werkt na conversie
- [ ] **Documentation:** Update deployment docs

### 🔄 CONVERSIE PLAN (Indien gekozen voor Optie B)

**Pre-conversie checklist:**
- [ ] Huidige submodule setup werkt volledig
- [ ] Alle tests slagen
- [ ] Backup branch is up-to-date
- [ ] Team is geïnformeerd over wijziging

**Conversie stappen:**
- [ ] Stap 1: Backup commit maken
- [ ] Stap 2: Submodule configuratie verwijderen
- [ ] Stap 3: STORM source direct in project plaatsen
- [ ] Stap 4: Git add en commit nieuwe structuur
- [ ] Stap 5: Baseline tag maken
- [ ] Stap 6: Testen dat alles nog werkt
- [ ] Stap 7: Update documentation

**Post-conversie verificatie:**
- [ ] Docker build succesvol
- [ ] STORM imports werken nog
- [ ] V2 runner functioneert
- [ ] Deployment process werkt
- [ ] Rollback mogelijk naar backup

---

## 🚨 BELANGRIJKE BACKUP INFORMATIE

### Rollback Commands (BEWAAR DEZE!)
```bash
# Terug naar werkenede versie
git checkout backup-before-storm-migration
docker-compose down
docker-compose up --build

# Of specifiek alleen backend rollback
git checkout backup-before-storm-migration -- backend/
docker-compose restart backend
```

### Current Working Configuration Backup
- ✅ Huidige `requirements.txt` gebruikt: `knowledge_storm`  
- ✅ Huidige `storm_runner.py` werkt met pip package  
- ✅ Huidige endpoints functioneel op: `/api/v1/storm/run`, `/api/v1/storm/status/{id}`  

---

## FASE 1: PREPARATIE & BACKUP (Week 1)

### ✅ Stap 1.1: Git Backup Maken
- [x] **Command:** `git checkout -b backup-before-storm-migration`
- [x] **Command:** `git add . && git commit -m "Backup before STORM repository migration"`
- [x] **Command:** `git push origin backup-before-storm-migration`
- [x] **Verify:** Backup branch exists op GitHub/remote
- [x] **Document:** Commit hash van backup: `227f357896890432172d2d33cc592aaae7227032`

### ✅ Stap 1.2: Nieuwe Development Branch
- [x] **Command:** `git checkout main`
- [x] **Command:** `git checkout -b storm-repository-integration`
- [x] **Command:** `git push origin storm-repository-integration`

### ✅ Stap 1.3: Current State Documentation
- [ ] **Test:** Huidige Storm functionaliteit werkt (maak test run)
- [ ] **Document:** Test topic gebruikt: `________________`
- [ ] **Document:** Test succeeded: ✅/❌
- [ ] **Screenshot:** Bewaar screenshot van werkende dashboard

### ✅ Stap 1.4: Dependencies Backup
- [x] **Backup:** `cp backend/requirements.txt backend/requirements.txt.backup`
- [x] **Backup:** `cp backend/app/storm_runner.py backend/app/storm_runner.py.backup`

---

## FASE 2: STANFORD STORM SUBMODULE SETUP (Week 1-2)

### ✅ Stap 2.1: Git Submodule Toevoegen
- [x] **Command:** `cd backend/`
- [x] **Command:** `mkdir -p external`
- [x] **Command:** `git submodule add https://github.com/stanford-oval/storm.git external/storm`
- [x] **Command:** `git submodule update --init --recursive`
- [x] **Verify:** `ls backend/external/storm/knowledge_storm/` toont STORM code
- [x] **Commit:** `git add . && git commit -m "Add Stanford STORM as submodule"`

### ✅ Stap 2.2: STORM Dependencies Installeren
- [x] **Edit:** `backend/requirements.txt` - comment out `knowledge_storm`
- [x] **Add:** Nieuwe dependencies (zie requirements hieronder)
- [x] **Command:** `docker-compose build backend`
- [x] **Test:** `docker-compose up backend` start zonder errors
- [x] **Verify:** Check logs voor import errors

#### Nieuwe Requirements.txt Sectie
```txt
# STORM Repository Dependencies (vervangen knowledge_storm)
dspy
litellm
pydantic>=2.0.0
pandas
beautifulsoup4
sentence-transformers
# knowledge_storm  # COMMENTED OUT tijdens migratie
```

### ✅ Stap 2.3: Python Path Setup Testen
- [x] **Create:** `backend/app/test_storm_import.py` (zie code hieronder)
- [x] **Test:** `docker-compose exec backend python /app/app/test_storm_import.py`
- [x] **Verify:** Geen import errors
- [x] **Document:** Welke imports werkten: `✅ Core STORM imports, ✅ LM imports, ✅ RM imports`

#### Test Import Script
```python
# backend/app/test_storm_import.py
import sys
from pathlib import Path

# Add STORM repository to path
STORM_PATH = Path(__file__).parent / "external/storm"
if str(STORM_PATH) not in sys.path:
    sys.path.insert(0, str(STORM_PATH))

try:
    from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
    print("✅ Core STORM imports successful")
except ImportError as e:
    print(f"❌ Core STORM imports failed: {e}")

try:
    from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel, LitellmModel
    print("✅ LM imports successful")
except ImportError as e:
    print(f"❌ LM imports failed: {e}")

try:
    from knowledge_storm.rm import YouRM, BingSearch, TavilySearchRM
    print("✅ RM imports successful")
except ImportError as e:
    print(f"❌ RM imports failed: {e}")

print("STORM path:", STORM_PATH)
print("Path exists:", STORM_PATH.exists())
```

---

## FASE 3: HYBRIDE SETUP IMPLEMENTATIE (Week 2-3)

### ✅ Stap 3.1: storm_runner_v2.py Maken
- [ ] **Create:** `backend/app/storm_runner_v2.py` (zie skeleton hieronder)
- [ ] **Test:** Import test van nieuwe runner
- [ ] **Verify:** Geen syntax errors

### ✅ Stap 3.2: Environment Variable Setup
- [ ] **Edit:** `.env` - add `STORM_RUNNER_VERSION=v1`
- [ ] **Edit:** `backend/app/core/config.py` - add setting
- [ ] **Test:** Environment variable wordt geladen

### ✅ Stap 3.3: Smart Factory Pattern
- [ ] **Edit:** `backend/app/storm_runner.py` - add factory logic
- [ ] **Test:** Factory returns correct runner based on env var
- [ ] **Verify:** v1 (huidige) werkt nog steeds

### ✅ Stap 3.4: Basic V2 Implementation
- [ ] **Implement:** Basis configuratie in `storm_runner_v2.py`
- [ ] **Test:** V2 runner initializes without errors
- [ ] **Verify:** Kan basic STORM run uitvoeren

---

## FASE 4: TESTING & VALIDATION (Week 3-4)

### ✅ Stap 4.1: Side-by-Side Testing
- [ ] **Test:** Same topic met V1 runner
- [ ] **Test:** Same topic met V2 runner  
- [ ] **Compare:** Output files (article, outline, sources)
- [ ] **Document:** Verschillen gevonden: `________________`

#### Test Topics
1. "Artificial Intelligence in Healthcare"
2. "Climate Change Solutions"
3. "Quantum Computing Basics"

### ✅ Stap 4.2: Performance Vergelijking
- [ ] **Measure:** V1 execution time
- [ ] **Measure:** V2 execution time
- [ ] **Measure:** Memory usage
- [ ] **Document:** Performance resultaten: `________________`

### ✅ Stap 4.3: Error Handling Test
- [ ] **Test:** Invalid API keys
- [ ] **Test:** Network failures
- [ ] **Test:** Malformed topics
- [ ] **Verify:** Both versions handle errors gracefully

### ✅ Stap 4.4: Frontend Integration Test
- [ ] **Test:** Dashboard works with V1
- [ ] **Test:** Dashboard works with V2
- [ ] **Verify:** No breaking changes in API responses

---

## FASE 5: PRODUCTION READINESS (Week 4)

### ✅ Stap 5.1: Configuration Management
- [ ] **Implement:** Admin panel toggle voor STORM version
- [ ] **Test:** Runtime switching tussen versions
- [ ] **Verify:** No service disruption during switch

### ✅ Stap 5.2: Docker Integration
- [ ] **Update:** Dockerfile voor submodule support
- [ ] **Update:** docker-compose.yml if needed
- [ ] **Test:** Complete container rebuild
- [ ] **Verify:** Production-like environment works

### ✅ Stap 5.3: Documentation Update
- [ ] **Update:** README.md met nieuwe setup
- [ ] **Update:** DEPLOYMENT.md
- [ ] **Create:** STORM_CUSTOMIZATION.md guide

### ✅ Stap 5.4: Migration Decision Point
- [ ] **Review:** All tests passed
- [ ] **Review:** Performance acceptable
- [ ] **Review:** No critical issues found
- [ ] **Decision:** ✅ Proceed with V2 as default / ❌ Stay with V1
- [ ] **Action:** Update `STORM_RUNNER_VERSION=v2` in production env

---

## CODE TEMPLATES

### storm_runner_v2.py Skeleton
```python
# backend/app/storm_runner_v2.py
import sys
import os
from pathlib import Path
from typing import Optional

# Add STORM repository to Python path
STORM_PATH = Path(__file__).parent / "external/storm"
if str(STORM_PATH) not in sys.path:
    sys.path.insert(0, str(STORM_PATH))

# Import from local STORM repository
try:
    from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
    from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel, LitellmModel
    from knowledge_storm.rm import YouRM, BingSearch, TavilySearchRM
    STORM_V2_AVAILABLE = True
    print("✅ STORM V2 (repository) dependencies loaded successfully")
except ImportError as e:
    print(f"❌ Failed to import STORM V2 dependencies: {e}")
    STORM_V2_AVAILABLE = False

def get_storm_runner_v2() -> Optional[STORMWikiRunner]:
    """
    Initialize STORM runner using the repository version for deep customization
    """
    if not STORM_V2_AVAILABLE:
        print("STORM V2 dependencies not available")
        return None
    
    # TODO: Implement configuration logic
    # Copy relevant parts from storm_runner.py maar met toegang tot source code
    
    try:
        # Your existing configuration logic here
        print("🚀 Initializing STORM V2 (repository version)")
        return None  # TODO: Return actual runner
    
    except Exception as e:
        print(f"❌ Failed to initialize STORM V2 runner: {e}")
        return None
```

### Factory Update voor storm_runner.py
```python
# Add to existing storm_runner.py
def get_storm_runner() -> Optional[STORMWikiRunner]:
    """Smart factory that chooses runner version based on configuration"""
    from .core.config import settings
    
    runner_version = getattr(settings, 'STORM_RUNNER_VERSION', 'v1')
     
    if runner_version == 'v2':
        try:
            from .storm_runner_v2 import get_storm_runner_v2
            print("🔄 Using STORM V2 (repository version)")
            return get_storm_runner_v2()
        except ImportError as e:
            print(f"⚠️ STORM V2 not available, falling back to V1: {e}")
            runner_version = 'v1'
    
    if runner_version == 'v1':
        print("🔄 Using STORM V1 (pip package)")
        return get_storm_runner_v1()  # Rename your current function
    
    print(f"❌ Unknown STORM runner version: {runner_version}")
    return None
```

---

## TROUBLESHOOTING GUIDE

### Common Issues & Solutions

#### Issue: Git Submodule Problems
```bash
# Reset submodule
git submodule deinit -f external/storm
git rm external/storm
rm -rf .git/modules/external/storm
git submodule add https://github.com/stanford-oval/storm.git external/storm
```

#### Issue: Python Import Errors
```bash
# Check if STORM path is correct
docker-compose exec backend ls -la /app/app/external/storm/
docker-compose exec backend python -c "import sys; print(sys.path)"
```

#### Issue: Docker Build Failures
```bash
# Clean build
docker-compose down
docker system prune -f
docker-compose build --no-cache backend
```

#### Issue: Requirements Conflicts
```bash
# Reset requirements
cp backend/requirements.txt.backup backend/requirements.txt
git checkout backup-before-storm-migration -- backend/requirements.txt
```

---

## SUCCESS CRITERIA

### ✅ Migration Considered Successful When:
- [ ] Both V1 and V2 runners work side-by-side
- [ ] No functionality regression in existing features
- [ ] Performance is comparable or better
- [ ] Easy rollback mechanism available
- [ ] Documentation is complete
- [ ] Team can make STORM customizations

### ✅ Ready for Production When:
- [ ] All tests pass
- [ ] Error handling is robust
- [ ] Monitoring/logging works
- [ ] Deployment process documented
- [ ] Rollback tested and verified

---

## ROLLBACK TRIGGERS

### 🚨 Immediate Rollback If:
- [ ] Production system becomes unstable
- [ ] Critical functionality breaks
- [ ] Performance degrades >50%
- [ ] Unable to resolve issues within 2 days

### 🚨 Rollback Procedure:
1. `git checkout backup-before-storm-migration`
2. `docker-compose down && docker-compose up --build`
3. Verify functionality restored
4. Investigate issues on separate branch

---

## TIMELINE TRACKING

- **Week 1:** Phases 1-2 (Backup & Submodule Setup)
- **Week 2:** Phase 3 (Hybride Implementation)  
- **Week 3:** Phase 4 (Testing & Validation)
- **Week 4:** Phase 5 (Production Readiness)

**Current Week:** ____  
**Current Phase:** ____  
**Next Milestone:** ____  

---

## NOTES & OBSERVATIONS

### Development Notes
```
[DATE] - [NOTE]
```

### Issues Encountered
```
[DATE] - [ISSUE] - [RESOLUTION]
```

### Performance Metrics
```
[DATE] - V1: [TIME]s, V2: [TIME]s - Topic: [TOPIC]
```

---

**Last Updated:** [DATE]  
**Updated By:** [NAME]  
**Status:** 🟡 In Progress / 🟢 Complete / 🔴 Blocked 