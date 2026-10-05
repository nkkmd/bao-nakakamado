"""MIT. Read-only exported integer prediction; no optimization or key access."""
import json
import pathlib
import sys
import importlib.util

module_spec = importlib.util.spec_from_file_location('formal_trainer', pathlib.Path(__file__).with_name('formal-learning-trainer.py'))
trainer = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(trainer)
if __name__ == '__main__':
    model = json.loads(pathlib.Path(sys.argv[1]).read_text())
    views = json.loads(pathlib.Path(sys.argv[2]).read_text())
    predictions = trainer.predict(model, [r['input'] for r in views], [r['opponentInput'] for r in views])
    print(json.dumps(predictions.tolist()))
