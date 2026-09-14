from time import perf_counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer


DEFAULT_TFIDF_CONFIG = {
    "ngram_range": (1, 2),
    "min_df": 2,
    "max_df": 0.98,
    "max_features": 150_000,
    "sublinear_tf": True,
    "lowercase": True,
    "strip_accents": None,
    "stop_words": None,
    "dtype": np.float32,
}


def fit_label_binarizer(
    labels: list[list[str]], classes: list[str]
) -> tuple[MultiLabelBinarizer, np.ndarray]:
    binarizer = MultiLabelBinarizer(classes=classes)
    return binarizer, binarizer.fit_transform(labels)


def fit_tfidf(
    train_texts: list[str], config: dict | None = None
) -> tuple[TfidfVectorizer, object, float]:
    effective_config = dict(DEFAULT_TFIDF_CONFIG)
    if config:
        effective_config.update(config)
    vectorizer = TfidfVectorizer(**effective_config)
    started = perf_counter()
    matrix = vectorizer.fit_transform(train_texts)
    return vectorizer, matrix, perf_counter() - started
