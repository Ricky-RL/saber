from fastapi import APIRouter, HTTPException, Body
from supabase_client import supabase
from pydantic import BaseModel

router = APIRouter(prefix="/store", tags=["store"])

class PurchaseRequest(BaseModel):
    user_id: str
    item_id: str

class EquipRequest(BaseModel):
    user_id: str
    item_id: str
    item_type: str

@router.get("/items")
def get_store_items():
    try:
        response = supabase.table("store_items").select("*").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching store items: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/balance/{user_id}")
def get_user_balance(user_id: str):
    try:
        # Calculate total earned score
        stats_response = supabase.table("user_statistics").select("score").eq("user_id", user_id).execute()
        total_earned = sum(row['score'] for row in stats_response.data) if stats_response.data else 0

        # Calculate total spent
        purchases_response = supabase.table("user_purchases").select("cost").eq("user_id", user_id).execute()
        total_spent = sum(row['cost'] for row in purchases_response.data) if purchases_response.data else 0

        current_balance = total_earned - total_spent
        return {"balance": current_balance}
    except Exception as e:
        print(f"Error fetching balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/purchases/{user_id}")
def get_user_purchases(user_id: str):
    try:
        response = supabase.table("user_purchases").select("item_id").eq("user_id", user_id).execute()
        return [row['item_id'] for row in response.data] if response.data else []
    except Exception as e:
         print(f"Error fetching purchases: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@router.post("/purchase")
def purchase_item(request: PurchaseRequest):
    try:
        user_id = request.user_id
        item_id = request.item_id

        # 1. Get Item Cost
        item_response = supabase.table("store_items").select("*").eq("id", item_id).single().execute()
        if not item_response.data:
            raise HTTPException(status_code=404, detail="Item not found")
        item = item_response.data
        cost = item['cost']

        # Allow free items to be "purchased" freely or just handle them as owned.
        # IF Cost is 0, we just record it (e.g., claiming a free item).

        # 2. Check Balance
        if cost > 0:
            balance_res = get_user_balance(user_id)
            if balance_res['balance'] < cost:
                raise HTTPException(status_code=400, detail="Insufficient funds")

        # 3. Check if already purchased
        existing = supabase.table("user_purchases").select("*").eq("user_id", user_id).eq("item_id", item_id).execute()
        if existing.data:
             raise HTTPException(status_code=400, detail="Item already purchased")

        # 4. Record Purchase
        purchase_data = {
            "user_id": user_id,
            "item_id": item_id,
            "cost": cost
        }
        supabase.table("user_purchases").insert(purchase_data).execute()
        
        return {"message": "Purchase successful", "new_balance": balance_res['balance'] - cost}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error processing purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/equipped/{user_id}")
def get_equipped_items(user_id: str):
    try:
        # Get equipped items and join with store_items to get details (like value/color)
        response = supabase.table("user_equipped_items")\
            .select("item_type, item_id, store_items(value, name)")\
            .eq("user_id", user_id)\
            .execute()
        
        # Format for frontend
        equipped = {}
        if response.data:
            for row in response.data:
                equipped[row['item_type']] = {
                    "item_id": row['item_id'],
                    "value": row['store_items']['value'],
                    "name": row['store_items']['name']
                }
        return equipped
    except Exception as e:
        print(f"Error fetching equipped items: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/equip")
def equip_item(request: EquipRequest):
    try:
        user_id = request.user_id
        item_id = request.item_id
        item_type = request.item_type

        # Verify ownership
        # EXCEPTION: If item cost is 0, it is implicitly owned by everyone.
        item_info = supabase.table("store_items").select("cost").eq("id", item_id).single().execute()
        
        is_free_item = False
        if item_info.data and item_info.data.get('cost') == 0:
            is_free_item = True

        if not is_free_item:
            purchase_check = supabase.table("user_purchases").select("*").eq("user_id", user_id).eq("item_id", item_id).execute()
            if not purchase_check.data:
                 raise HTTPException(status_code=403, detail="You do not own this item")

        # Upsert into equipped items
        data = {
            "user_id": user_id,
            "item_type": item_type,
            "item_id": item_id
        }
        supabase.table("user_equipped_items").upsert(data).execute()
        
        return {"message": "Item equipped successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error equipping item: {e}")
        raise HTTPException(status_code=500, detail=str(e))
