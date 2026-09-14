import unittest

from src.training.features import (
    DEFAULT_TFIDF_CONFIG,
    fit_label_binarizer,
    fit_tfidf,
)


class TrainingFeaturesTest(unittest.TestCase):
    def test_binarizes_multilabel_in_explicit_official_order(self):
        labels = [["46", "34"], ["46"]]

        binarizer, matrix = fit_label_binarizer(labels, ["34", "46", "56"])

        self.assertEqual(binarizer.classes_.tolist(), ["34", "46", "56"])
        self.assertEqual(matrix.tolist(), [[1, 1, 0], [0, 1, 0]])

    def test_tfidf_vocabulary_is_fitted_only_on_train(self):
        vectorizer, train_matrix, fit_seconds = fit_tfidf(
            ["educação pública federal", "administração pública federal"],
            {**DEFAULT_TFIDF_CONFIG, "min_df": 1},
        )
        validation_matrix = vectorizer.transform(["tokenexclusivovalidacao educação"])

        self.assertNotIn("tokenexclusivovalidacao", vectorizer.vocabulary_)
        self.assertEqual(train_matrix.shape[0], 2)
        self.assertEqual(validation_matrix.shape[1], train_matrix.shape[1])
        self.assertGreaterEqual(fit_seconds, 0)


if __name__ == "__main__":
    unittest.main()
