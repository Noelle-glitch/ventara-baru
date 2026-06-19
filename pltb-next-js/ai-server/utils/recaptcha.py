import os
import requests

def verify_recaptcha(token):
    secret_key = os.getenv("RECAPTCHA_SECRET_KEY")

    response = requests.post(
        "https://www.google.com/recaptcha/api/siteverify",
        data={
            "secret": secret_key,
            "response": token
        }
    )

    result = response.json()
    
    print(result)

    return result.get("success", False)