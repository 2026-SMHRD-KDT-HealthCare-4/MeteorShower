"""
RAG 모듈 — 운동 정보를 ChromaDB에 벡터화하여 저장하고,
사용자 질문과 가장 관련 있는 운동 정보를 검색해 반환합니다.
"""
import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

_CHROMA_PATH = str(Path(__file__).parent.parent / "chroma_db")
_COLLECTION_NAME = "exercises"
_TOP_K = 3

_oai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small",
)

_client = chromadb.PersistentClient(path=_CHROMA_PATH)
_collection = _client.get_or_create_collection(
    name=_COLLECTION_NAME,
    embedding_function=_oai_ef,
)


def index_exercises(exercises: list[dict]) -> None:
    """
    exercises: [{"id": 1, "name": "손목 굴곡", "duration": 120}, ...]
    기존 컬렉션을 초기화 후 재색인합니다.
    """
    if not exercises:
        return

    # 이미 동일한 데이터면 스킵
    existing_ids = set(_collection.get()["ids"])
    new_ids = {str(ex["id"]) for ex in exercises}
    if existing_ids == new_ids:
        return

    # 전부 지우고 다시 색인
    if existing_ids:
        _collection.delete(ids=list(existing_ids))

    documents = []
    ids = []
    metadatas = []

    for ex in exercises:
        duration_text = f"예상 소요 시간: {ex['duration']}초" if ex.get("duration") else ""
        doc = f"운동 이름: {ex['name']}. {duration_text}".strip()
        documents.append(doc)
        ids.append(str(ex["id"]))
        metadatas.append({"name": ex["name"]})

    _collection.add(documents=documents, ids=ids, metadatas=metadatas)


def search_exercises(query: str) -> str:
    """
    질문과 관련된 운동 정보를 검색해 문자열로 반환합니다.
    관련 운동이 없으면 빈 문자열을 반환합니다.
    """
    count = _collection.count()
    if count == 0:
        return ""

    results = _collection.query(
        query_texts=[query],
        n_results=min(_TOP_K, count),
    )

    docs = results.get("documents", [[]])[0]
    if not docs:
        return ""

    return "\n".join(f"- {d}" for d in docs)
