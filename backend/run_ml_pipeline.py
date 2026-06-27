import asyncio
from app.database import AsyncSessionLocal
from app.ml.dropout import train_dropout_model, score_dropout_predictions

async def run():
    print("Training model...")
    from app.config import get_settings
    settings = get_settings()
    
    import anyio
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
