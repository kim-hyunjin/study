import random
from app.chat.redis import client

COMPONENT_TYPES = ("llm", "retriever", "memory")


def _values_key(component_type: str) -> str:
    """컴포넌트 점수 합계를 저장하는 Redis 해시 키"""
    return f"{component_type}_score_values"


def _counts_key(component_type: str) -> str:
    """컴포넌트 평가 횟수를 저장하는 Redis 해시 키"""
    return f"{component_type}_score_counts"


def _average_scores(component_type: str, names) -> dict:
    """
    주어진 컴포넌트 이름들의 평균 점수를 계산한다.
    평가 이력이 없는 컴포넌트는 1.0(최고점)을 기본값으로 두어 한 번은 선택되게 한다.
    """
    values = client.hgetall(_values_key(component_type))
    counts = client.hgetall(_counts_key(component_type))

    averages = {}
    for name in names:
        score = float(values.get(name, 1))
        count = float(counts.get(name, 1))
        averages[name] = score / count

    return averages


def score_conversation(
    conversation_id: str, score: float, llm: str, retriever: str, memory: str
) -> None:
    """
    대화에 매겨진 점수를 컴포넌트(llm, retriever, memory)별로 누적한다.

    각 컴포넌트마다 점수 합계와 평가 횟수를 따로 저장하며,
    평균 점수는 이후 get_scores / random_component_by_score에서 계산한다.

    :param conversation_id: 점수를 매길 대화의 고유 식별자
    :param score: 대화에 매겨진 점수
    :param llm: 이 대화에 사용된 언어 모델 이름
    :param retriever: 이 대화에 사용된 검색기 이름
    :param memory: 이 대화에 사용된 메모리 이름

    Example Usage:

    score_conversation('abc123', 0.75, 'llm_info', 'retriever_info', 'memory_info')
    """

    score = min(max(score, 0), 1)

    for component_type, name in zip(COMPONENT_TYPES, (llm, retriever, memory)):
        # 점수는 0~1 사이의 실수이므로 hincrby(정수)가 아닌 hincrbyfloat를 써야 한다.
        # hincrby를 쓰면 0.75 같은 점수가 0으로 절삭된다.
        client.hincrbyfloat(_values_key(component_type), name, score)
        client.hincrby(_counts_key(component_type), name, 1)


def get_scores():
    """
    컴포넌트 유형/이름별 평균 점수를 중첩 딕셔너리로 반환한다.
    바깥 키는 컴포넌트 유형, 안쪽 키는 컴포넌트 이름이며 값은 점수 배열이다.

    :return: 컴포넌트 유형과 이름으로 정리된 점수 딕셔너리

    Example:

        {
            'llm': {
                'chatopenai-3.5-turbo': [score1],
                'chatopenai-4': [score2]
            },
            'retriever': { 'pinecone_store': [score3] },
            'memory': { 'persist_memory': [score4] }
        }
    """

    aggregate = {}
    for component_type in COMPONENT_TYPES:
        # 저장된 이름 전체를 대상으로 평균을 낸다
        names = client.hgetall(_values_key(component_type)).keys()
        aggregate[component_type] = {
            name: [avg] for name, avg in _average_scores(component_type, names).items()
        }

    return aggregate


def random_component_by_score(component_type, component_map):
    """
    유저 평가에 따라 컴포넌트 선택하는 함수
    점수가 높을 수록 선택될 확률이 높아진다
    """
    if component_type not in COMPONENT_TYPES:
        raise ValueError("not valid component type")

    # 평균이 0이어도 최소 0.1의 가중치를 남겨 탐색(exploration) 여지를 둔다
    avg_scores = {
        name: max(avg, 0.1)
        for name, avg in _average_scores(component_type, component_map.keys()).items()
    }

    sum_scores = sum(avg_scores.values())
    random_val = random.uniform(0, sum_scores)
    cumulative = 0
    for name, score in avg_scores.items():
        cumulative += score
        if random_val <= cumulative:
            return name
