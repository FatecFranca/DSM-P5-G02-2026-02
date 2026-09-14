import unittest

import numpy as np

from src.training.train import _error_analysis, render_model_report


class TrainingReportTest(unittest.TestCase):
    def test_renders_split_leakage_models_and_errors(self):
        report = {
            "metadata": {"years": [2023, 2024, 2025]},
            "dataset": {"documents": 10, "classes": 2, "average_labels": 1.2},
            "groups": {
                "groups": 9,
                "duplicate_groups": 1,
                "conflicting_groups": 1,
                "conflicting_documents": 2,
            },
            "split": {
                "train": {"documents": 6, "groups": 5, "percentage": 60.0, "average_labels": 1.0},
                "validation": {"documents": 2, "groups": 2, "percentage": 20.0, "average_labels": 1.5},
                "test": {"documents": 2, "groups": 2, "percentage": 20.0, "average_labels": 1.5},
                "intersections": {"train_validation": 0, "train_test": 0, "validation_test": 0},
            },
            "tfidf": {"config": {"min_df": 1}, "features": 12, "fit_seconds": 0.01},
            "models": [
                {"name": "sgd_balanced", "training_seconds": 0.1, "validation_inference_seconds": 0.01, "validation_metrics": {"f1_micro": 0.8, "f1_macro": 0.7}}
            ],
            "trivial_baseline": {"strategy": "top-1", "validation_metrics": {"f1_micro": 0.2, "f1_macro": 0.1}},
            "selected_model": {"name": "sgd_balanced", "reason": "melhor validação"},
            "test_metrics": {
                "precision_micro": 0.8,
                "recall_micro": 0.7,
                "f1_micro": 0.75,
                "precision_macro": 0.7,
                "recall_macro": 0.6,
                "f1_macro": 0.65,
                "subset_accuracy": 0.5,
                "hamming_loss": 0.2,
                "jaccard_samples": 0.6,
                "per_class": [],
            },
            "examples": [],
            "error_analysis": {},
            "artifacts": {"reload_validated": True},
        }

        markdown = render_model_report(report)

        self.assertIn("# Baselines de Classificação Temática Multi-label", markdown)
        self.assertIn("## Validação anti-leakage", markdown)
        self.assertIn("sgd_balanced", markdown)
        self.assertIn("## Análise de erros", markdown)

    def test_selects_distinct_error_categories_when_available(self):
        classes = [
            {"code": "34", "name": "Administração Pública"},
            {"code": "46", "name": "Educação"},
        ]
        documents = [
            {"document_id": "CAMARA:1", "ementa": "Falso positivo.", "group_id": "a"},
            {"document_id": "CAMARA:2", "ementa": "Falso negativo.", "group_id": "b"},
            {"document_id": "CAMARA:3", "ementa": "Acerto parcial.", "group_id": "c"},
        ]
        actual = np.array([[1, 0], [1, 1], [1, 1]])
        predicted = np.array([[1, 1], [1, 0], [0, 1]])

        errors = _error_analysis(documents, actual, predicted, classes)

        self.assertEqual(errors["false_positive"]["document_id"], "CAMARA:1")
        self.assertEqual(errors["false_negative"]["document_id"], "CAMARA:2")
        self.assertEqual(errors["partial_multilabel"]["document_id"], "CAMARA:3")


if __name__ == "__main__":
    unittest.main()
