import os
from flask import session
from config import (
    ACTIVE_DATASET_FILE,
    DEFAULT_DATASET,
    ALLOWED_EXTENSIONS
)
# =========================
# GET ACTIVE DATASET
# =========================
def get_active_dataset_path() -> str:
    if os.path.exists(ACTIVE_DATASET_FILE):
        with open(ACTIVE_DATASET_FILE, "r") as f:
            path = f.read().strip()
        if path and os.path.exists(path):
            return path
    return DEFAULT_DATASET

# =========================
# SET ACTIVE DATASET
# =========================
def set_active_dataset_path(
    path: str
) -> None:
    with open(ACTIVE_DATASET_FILE, "w") as f:
        f.write(path)

# =========================
# GET ACTIVE DATASET PER USER
# =========================
def get_active_dataset_path_for_user() -> str:
    from utils.user_helpers import load_user
    username = session.get("username")
    print(f"🔍 GET DATASET - session username: {username}")  # ← tambah
    if username:
        user = load_user(username)
        print(f"🔍 USER DATA: {user}")  # ← tambah
        if user:
            path = user.get("active_dataset", "")
            if path and os.path.exists(path):
                return path
    return get_active_dataset_path()

# =========================
# SET ACTIVE DATASET PER USER
# =========================
def set_active_dataset_path_for_user(path: str) -> None:
    from utils.user_helpers import load_user, save_user 
    username = session.get("username")
    if username:
        user = load_user(username)
        if user:
            user["active_dataset"] = path
            save_user(user)
    set_active_dataset_path(path)

# =========================
# VALIDATE FILE
# =========================
def allowed_file(
    filename: str
) -> bool:
    return (
        "." in filename
        and
        filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )