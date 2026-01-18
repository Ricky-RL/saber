from fastapi import APIRouter
from .jwt import router as jwt_router
from .elevenlabs import router as elevenlabs_router
from .quiz import router as quiz_router
from .lyra import router as lyra_router
from .game import router as game_router
from .documents import router as documents_router
from .items import router as items_router
from .wrapped import router as wrapped_router
from .stats import router as stats_router

router = APIRouter()

router.include_router(jwt_router)
router.include_router(elevenlabs_router)
router.include_router(quiz_router)
router.include_router(lyra_router)
router.include_router(game_router)
router.include_router(documents_router)
router.include_router(items_router)
router.include_router(wrapped_router)
router.include_router(stats_router)