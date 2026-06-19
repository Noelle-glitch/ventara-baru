from flask import Blueprint, request, jsonify, session
import os, json
from config import UPLOAD_FOLDER

history_bp = Blueprint("history_bp", __name__)

# =========================
# TIER LIMITS
# =========================
TIER_LIMITS = {
    "gratis":    10 * 1024 * 1024,   # 10 MB
    "basic":    100 * 1024 * 1024,   # 100 MB
    "pro":      1 * 1024 * 1024 * 1024,  # 1 GB
    "business": 10 * 1024 * 1024 * 1024, # 10 GB
}

def get_username():
    return request.headers.get("X-Username") or session.get("username")

def get_history_usage_bytes(user: dict) -> int:
    return len(json.dumps(user.get("history", [])).encode("utf-8"))


# =========================
# SAVE HISTORY
#=========================
@history_bp.route("/save_history", methods=["POST"])
def save_history():
    from utils.user_helpers import load_user, save_user
    from config import UPLOAD_FOLDER

    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data provided."}), 400

    tier = user.get("storage_tier", "gratis")
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["gratis"])

    # hitung usage sama persis dengan storage_info
    history_size = get_history_usage_bytes(user)

    csv_paths = set()
    for item in user.get("history", []):
        entry = item.get("entry", item)
        file_name = entry.get("file", "")
        if file_name:
            candidate = os.path.join(UPLOAD_FOLDER, file_name)
            if os.path.exists(candidate):
                csv_paths.add(candidate)

    # tambah CSV dari entry baru
    new_entry = data.get("entry", data)
    new_file = new_entry.get("file", "")
    if new_file:
        candidate = os.path.join(UPLOAD_FOLDER, new_file)
        if os.path.exists(candidate) and candidate not in csv_paths:
            csv_paths.add(candidate)

    csv_size = sum(os.path.getsize(p) for p in csv_paths)
    current_usage = history_size + csv_size
    new_entry_size = len(json.dumps(data).encode("utf-8"))

    if current_usage + new_entry_size > limit:
        return jsonify({
            "success": False,
            "message": "Storage penuh. Upgrade tier untuk menyimpan lebih banyak.",
            "storage_full": True,
            "tier": tier,
            "usage": current_usage,
            "limit": limit,
        }), 403

    if "history" not in user:
        user["history"] = []

    user["history"].insert(0, data)
    save_user(user)

    return jsonify({"success": True, "message": "History saved"})


# =========================
# GET HISTORY
# =========================
@history_bp.route("/get_history", methods=["GET"])
def get_history():
    from utils.user_helpers import load_user

    username = get_username()

    if not username:
        return jsonify([]), 401

    user = load_user(username)

    if not user:
        return jsonify([]), 404

    history = user.get("history", [])

    result = []

    for item in history:
        if isinstance(item, dict) and "entry" in item:
            result.append(item["entry"])
        else:
            result.append(item)

    return jsonify(result)


# =========================
# STORAGE INFO
# =========================
@history_bp.route("/storage_info", methods=["GET"])
def storage_info():
    from utils.user_helpers import load_user
    from utils.dataset import get_active_dataset_path_for_user

    username = get_username()
    print("USERNAME =", username)

    if not username:
        return jsonify({"success": False}), 401

    user = load_user(username)
    print("USER =", user)

    if not user:
        return jsonify({"success": False}), 404

    tier = user.get("storage_tier", "gratis")
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["gratis"])

    # history size
    history_size = get_history_usage_bytes(user)

    # csv size
    csv_paths = set()
    for item in user.get("history", []):
        entry = item.get("entry", item)
        file_name = entry.get("file", "")
        if file_name:
            candidate = os.path.join(UPLOAD_FOLDER, file_name)
            if os.path.exists(candidate):
                csv_paths.add(candidate)
                
    csv_size = sum(os.path.getsize(path) for path in csv_paths)

    usage = history_size + csv_size

    print("HISTORY COUNT =", len(user.get("history", [])))
    print("HISTORY SIZE =", history_size)
    print("CSV SIZE =", csv_size)
    print("TOTAL USAGE =", usage)

    return jsonify({
        "success": True,
        "tier": tier,
        "usage": usage,
        "limit": limit,
        "usage_mb": round(usage / 1024 / 1024, 4),
        "limit_mb": round(limit / 1024 / 1024, 2),
        "percent": round((usage / limit) * 100, 4),
    })

# =========================
# UPGRADE TIER
# =========================
@history_bp.route("/upgrade_tier", methods=["POST"])
def upgrade_tier():
    from utils.user_helpers import load_user, save_user

    username = get_username()
    if not username:
        return jsonify({"success": False}), 401

    data = request.get_json()
        
    new_tier = data.get("tier")

    if new_tier not in TIER_LIMITS:
        return jsonify({"success": False, "message": "Tier tidak valid."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False}), 404

    user["storage_tier"] = new_tier
    save_user(user)

    return jsonify({
        "success": True,
        "tier": new_tier,
        "limit_mb": round(TIER_LIMITS[new_tier] / 1024 / 1024, 2),
    })


# =========================
# DELETE HISTORY
# =========================
@history_bp.route("/delete_history", methods=["DELETE"])
def delete_history():
    from utils.user_helpers import load_user, save_user

    username = get_username()
    if not username:
        return jsonify({"success": False}), 401

    entry_id = request.args.get("id")
    if not entry_id:
        return jsonify({"success": False, "message": "ID required."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False}), 404

    user["history"] = [
    h for h in user.get("history", [])
    if str((h.get("entry") or h).get("id")) != str(entry_id)
]
    save_user(user)

    return jsonify({"success": True})