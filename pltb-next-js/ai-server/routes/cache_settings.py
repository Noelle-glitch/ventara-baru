from flask import Blueprint, jsonify, request

from utils.cache_settings import (
    get_cache_settings,
    save_cache_settings
)

cache_settings_bp = Blueprint(
    "cache_settings",
    __name__
)

@cache_settings_bp.route(
    "/cache_settings",
    methods=["GET"]
)
def get_settings():

    return jsonify(
        get_cache_settings()
    )


@cache_settings_bp.route(
    "/cache_settings",
    methods=["POST"]
)
def update_settings():

    data = request.json

    settings = get_cache_settings()

    settings["model_cache"] = data.get(
        "model_cache",
        settings["model_cache"]
    )

    settings["metrics_cache"] = data.get(
        "metrics_cache",
        settings["metrics_cache"]
    )

    save_cache_settings(settings)

    return jsonify({
        "success": True,
        "settings": settings
    })