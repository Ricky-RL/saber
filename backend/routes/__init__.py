from fastapi import APIRouter
from .jwt import router as jwt_router
from .elevenlabs import router as elevenlabs_router
from .items import router as items_router

router = APIRouter()

router.include_router(jwt_router)
router.include_router(elevenlabs_router)
router.include_router(items_router)
