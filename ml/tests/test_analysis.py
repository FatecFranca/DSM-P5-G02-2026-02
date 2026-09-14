import unittest

from src.analysis.report import analyze_dataset, render_markdown


class AnalysisTest(unittest.TestCase):
    def test_calculates_coverage_distribution_multilabel_and_cooccurrence(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2024,
                "tipo": "PL",
                "ementa": "Uma ementa suficientemente longa para não ser curta.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "34", "name": "Administração Pública", "path": None},
                    {"code": "46", "name": "Educação", "path": None},
                ],
            },
            {
                "source": "CAMARA",
                "external_id": 2,
                "ano": 2025,
                "tipo": "REQ",
                "ementa": "Curta.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "46", "name": "Educação", "path": None},
                ],
            },
            {
                "source": "SENADO",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "",
                "ementa_status": "empty",
                "labels": [],
            },
        ]

        report = analyze_dataset(documents, {"duplicate_id_rows": 0}, {})

        self.assertEqual(report["dataset"]["total_documents"], 3)
        self.assertEqual(report["text_quality"]["valid"], 2)
        self.assertEqual(report["text_quality"]["short"], 1)
        self.assertEqual(report["label_coverage"]["with_labels"], 2)
        self.assertAlmostEqual(report["label_coverage"]["percentage_labeled"], 66.6667)
        self.assertEqual(report["taxonomy"]["number_of_themes"], 2)
        self.assertEqual(report["multilabel"]["one_label"], 1)
        self.assertEqual(report["multilabel"]["two_labels"], 1)
        self.assertEqual(report["multilabel"]["maximum"], 2)
        self.assertEqual(report["cooccurrence"][0]["count"], 1)
        self.assertEqual(report["training_dataset"]["documents"], 2)

    def test_renders_human_readable_markdown(self):
        report = analyze_dataset([], {}, {"years": [2023, 2024, 2025]})

        markdown = render_markdown(report)

        self.assertIn("# Análise do Dataset Legislativo", markdown)
        self.assertIn("2023–2025", markdown)
        self.assertIn("Nenhum modelo foi treinado", markdown)
        self.assertIn("## Análise por Casa", markdown)
        self.assertIn("## Recomendação para taxonomia", markdown)

    def test_calculates_class_percentage_within_each_source(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto da Câmara com tamanho suficiente para análise.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "56", "name": "Saúde", "path": None}
                ],
            },
            {
                "source": "SENADO",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto do Senado com tamanho suficiente para análise.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "11", "name": "Saúde", "path": "Política Social / Saúde"}
                ],
            },
        ]

        report = analyze_dataset(documents, {}, {})

        for item in report["taxonomy"]["classes"]:
            self.assertEqual(item["percentage_of_source_labeled_documents"], 100.0)
            self.assertEqual(item["percentage_of_all_labeled_documents"], 50.0)
        self.assertEqual(report["source_analysis"]["CAMARA"]["with_labels"], 1)
        self.assertEqual(report["source_analysis"]["SENADO"]["with_labels"], 1)

    def test_reports_multilabel_and_cooccurrence_by_source(self):
        documents = [
            {
                "source": "SENADO",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto oficial suficientemente longo para análise.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "10", "name": "Política Social", "path": "Política Social"},
                    {"code": "11", "name": "Saúde", "path": "Política Social / Saúde"},
                ],
            }
        ]

        report = analyze_dataset(documents, {}, {})
        senate = report["source_analysis"]["SENADO"]

        self.assertEqual(senate["multilabel"]["two_labels"], 1)
        self.assertEqual(senate["cooccurrence"][0]["count"], 1)
        self.assertEqual(senate["cooccurrence"][0]["left"]["name"], "Política Social")

    def test_reports_official_classes_without_examples_separately(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto válido e longo o suficiente para análise.",
                "ementa_status": "valid",
                "labels": [
                    {"code": "46", "name": "Educação", "path": None}
                ],
            }
        ]
        official_taxonomy = [
            {"source": "CAMARA", "code": "46", "name": "Educação", "path": None},
            {"source": "CAMARA", "code": "85", "name": "Ciências Exatas", "path": None},
        ]

        report = analyze_dataset(documents, {}, {}, official_taxonomy)

        self.assertEqual(report["taxonomy"]["number_of_official_themes"], 2)
        self.assertEqual(report["taxonomy"]["number_of_observed_themes"], 1)
        self.assertEqual(report["taxonomy"]["classes"][-1]["documents"], 0)
        self.assertEqual(report["taxonomy"]["smallest_observed_class"]["code"], "46")
        self.assertEqual(
            report["taxonomy_recommendation"]["classes_without_examples"][0]["code"],
            "85",
        )


if __name__ == "__main__":
    unittest.main()
