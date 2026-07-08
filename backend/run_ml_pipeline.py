import asyncio

import anyio

from app.config import get_settings
from app.ml.dropout import score_dropout_predictions, train_dropout_model


async def run():
    print("Training model...")
    settings = get_settings()

    # train_dropout_model returns TrainResult which contains model_run_id
    result = await anyio.to_thread.run_sync(
        lambda: train_dropout_model(database_url=settings.database_url)
    )
    model_run_id = result.model_run_id
    
    print(f"Scoring predictions for model run {model_run_id}...")
    await anyio.to_thread.run_sync(
        lambda: score_dropout_predictions(model_run_id, database_url=settings.database_url)
    )
    print("Done!")


if __name__ == "__main__":
    asyncio.run(run())
