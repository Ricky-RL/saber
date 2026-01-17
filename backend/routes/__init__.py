from fastapi import APIRouter
from .jwt import router as jwt_router
from .elevenlabs import router as elevenlabs_router
from .quiz import router as quiz_router

router = APIRouter()

router.include_router(jwt_router)
router.include_router(elevenlabs_router)
router.include_router(quiz_router)