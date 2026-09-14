import numpy as np
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.multiclass import OneVsRestClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC


MODEL_CONFIGS = {
    "logistic_regression": {
        "algorithm": "LogisticRegression",
        "class_weight": None,
        "solver": "liblinear",
        "max_iter": 500,
        "C": 1.0,
        "threshold": 0.5,
    },
    "logistic_regression_balanced": {
        "algorithm": "LogisticRegression",
        "class_weight": "balanced",
        "solver": "liblinear",
        "max_iter": 500,
        "C": 1.0,
        "threshold": 0.5,
    },
    "linear_svc_balanced": {
        "algorithm": "LinearSVC",
        "class_weight": "balanced",
        "C": 1.0,
        "max_iter": 3000,
        "threshold": 0.0,
    },
    "sgd_balanced": {
        "algorithm": "SGDClassifier",
        "loss": "log_loss",
        "class_weight": "balanced",
        "alpha": 0.0001,
        "max_iter": 1000,
        "tol": 0.001,
        "threshold": 0.5,
    },
    "multinomial_nb": {
        "algorithm": "MultinomialNB",
        "alpha": 1.0,
        "threshold": 0.5,
    },
}


def build_model(name: str, seed: int = 42) -> OneVsRestClassifier:
    config = MODEL_CONFIGS.get(name)
    if config is None:
        raise ValueError(f"Modelo desconhecido: {name}")
    if config["algorithm"] == "LogisticRegression":
        estimator = LogisticRegression(
            C=config["C"],
            class_weight=config["class_weight"],
            max_iter=config["max_iter"],
            random_state=seed,
            solver=config["solver"],
        )
    elif config["algorithm"] == "LinearSVC":
        estimator = LinearSVC(
            C=config["C"],
            class_weight=config["class_weight"],
            max_iter=config["max_iter"],
            random_state=seed,
        )
    elif config["algorithm"] == "SGDClassifier":
        estimator = SGDClassifier(
            alpha=config["alpha"],
            class_weight=config["class_weight"],
            loss=config["loss"],
            max_iter=config["max_iter"],
            random_state=seed,
            tol=config["tol"],
        )
    else:
        estimator = MultinomialNB(alpha=config["alpha"])
    return OneVsRestClassifier(estimator, n_jobs=1)


def predict_multilabel(model: OneVsRestClassifier, features) -> np.ndarray:
    prediction = np.asarray(model.predict(features), dtype=np.int8)
    if prediction.ndim != 2:
        raise ValueError("A predição multi-label deve possuir duas dimensões.")
    return prediction
