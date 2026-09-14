import tempfile
import unittest
import warnings
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer

from src.training.artifacts import load_artifacts, save_artifacts
from src.training.metrics import evaluate_multilabel
from src.training.models import build_model, predict_multilabel


class TrainingModelsTest(unittest.TestCase):
    def test_trains_multilabel_model_on_small_sparse_fixture(self):
        texts = [
            "educação escola ensino",
            "educação professor escola",
            "saúde hospital médico",
            "saúde vacina hospital",
        ]
        labels = [["46"], ["46"], ["56"], ["56"]]
        vectorizer = TfidfVectorizer()
        features = vectorizer.fit_transform(texts)
        binarizer = MultiLabelBinarizer(classes=["46", "56"])
        targets = binarizer.fit_transform(labels)
        model = build_model("sgd_balanced", seed=42)

        model.fit(features, targets)
        predicted = predict_multilabel(model, features)

        self.assertEqual(predicted.shape, (4, 2))
        self.assertTrue(set(np.unique(predicted)).issubset({0, 1}))

    def test_calculates_expected_multilabel_metrics(self):
        actual = np.array([[1, 0], [1, 1], [0, 1]])
        predicted = np.array([[1, 0], [1, 0], [1, 1]])

        metrics = evaluate_multilabel(actual, predicted, ["34", "46"])

        self.assertAlmostEqual(metrics["f1_micro"], 0.75)
        self.assertAlmostEqual(metrics["f1_macro"], 0.7333333333333334)
        self.assertAlmostEqual(metrics["subset_accuracy"], 1 / 3)
        self.assertAlmostEqual(metrics["hamming_loss"], 1 / 3)
        self.assertEqual(len(metrics["per_class"]), 2)

    def test_persists_reloads_and_preserves_predictions_and_metadata(self):
        texts = ["educação escola", "saúde hospital"]
        labels = [["46"], ["56"]]
        vectorizer = TfidfVectorizer()
        features = vectorizer.fit_transform(texts)
        binarizer = MultiLabelBinarizer(classes=["46", "56"])
        targets = binarizer.fit_transform(labels)
        model = build_model("sgd_balanced", seed=42)
        model.fit(features, targets)
        expected = predict_multilabel(model, features)
        metadata = {
            "model_name": "sgd_balanced",
            "model_version": "experimental-1",
            "training_date": "2026-09-08T00:00:00+00:00",
            "source": "CAMARA",
            "years": [2023, 2024, 2025],
            "classes": ["46", "56"],
            "class_count": 2,
            "train_documents": 2,
            "validation_documents": 0,
            "test_documents": 0,
            "random_seed": 42,
            "tfidf_config": {},
            "model_config": {},
            "validation_metrics": {},
            "test_metrics": {},
        }
        with tempfile.TemporaryDirectory() as directory:
            paths = save_artifacts(
                Path(directory), model, vectorizer, binarizer, metadata
            )
            del model, vectorizer, binarizer

            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                loaded = load_artifacts(Path(directory))
            actual = predict_multilabel(
                loaded["model"], loaded["vectorizer"].transform(texts)
            )
            self.assertTrue(all(path.is_file() for path in paths.values()))

        np.testing.assert_array_equal(actual, expected)
        self.assertEqual(loaded["metadata"]["source"], "CAMARA")
        self.assertFalse(
            any(item.category is DeprecationWarning for item in caught),
            "O reload não deve expor warnings internos da dependência.",
        )

    def test_rejects_incomplete_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "metadata"):
                save_artifacts(
                    Path(directory), object(), object(), object(), {"source": "CAMARA"}
                )


if __name__ == "__main__":
    unittest.main()
