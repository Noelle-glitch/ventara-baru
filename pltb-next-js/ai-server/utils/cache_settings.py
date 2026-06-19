# utils/cache_settings.py

import os
import json

from config import MODEL_FOLDER

CACHE_SETTING_FILE = os.path.join(
    MODEL_FOLDER,
    "cache_settings.json"
)

DEFAULT_SETTING = {
    "model_cache": True,
    "metrics_cache": True
}


def get_cache_settings():

    if not os.path.exists(CACHE_SETTING_FILE):

        with open(CACHE_SETTING_FILE, "w") as f:
            json.dump(DEFAULT_SETTING, f, indent=2)

        return DEFAULT_SETTING

    with open(CACHE_SETTING_FILE, "r") as f:
        return json.load(f)


def save_cache_settings(settings):

    with open(CACHE_SETTING_FILE, "w") as f:
        json.dump(settings, f, indent=2)