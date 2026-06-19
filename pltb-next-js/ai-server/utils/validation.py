import pandas as pd

from config import (
    REQUIRED_COLUMNS,
    TARGET
)


def validate_csv(path: str) -> dict:

    errors = []

    info = {}

    try:

        df_check = pd.read_csv(
            path,
            nrows=5
        )

        info["columns"] = list(
            df_check.columns
        )

        info["preview"] = (
            df_check.to_dict(
                orient="records"
            )
        )

        missing = [
            c for c in REQUIRED_COLUMNS
            if c not in df_check.columns
        ]

        if missing:

            errors.append(
                f"Kolom wajib tidak ada: {missing}"
            )

        df_full = pd.read_csv(path)

        info["rows"] = len(df_full)

        info["cols"] = len(df_full.columns)

        if len(df_full) < 200:

            errors.append(
                f"Data terlalu sedikit ({len(df_full)} baris). Minimal 200."
            )

        if TARGET in df_full.columns:

            nulls = int(
                df_full[TARGET]
                .isna()
                .sum()
            )

            if nulls > 0:

                errors.append(
                    f"Kolom {TARGET} punya {nulls} nilai kosong."
                )

        for col in REQUIRED_COLUMNS:

            if col in df_full.columns:

                if not pd.api.types.is_numeric_dtype(
                    df_full[col]
                ):

                    errors.append(
                        f"Kolom {col} harus numerik."
                    )

    except Exception as e:

        errors.append(
            f"Gagal membaca CSV: {str(e)}"
        )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "info": info
    }