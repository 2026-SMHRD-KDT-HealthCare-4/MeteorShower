## Alembic (DB 마이그레이션)

### 처음 세팅 시

테이블이 이미 DB에 있는 경우:
docker exec -it backend-backend-1 bash
cd /app
alembic stamp head

테이블이 없는 경우 (새로 생성해야 할 때):
docker exec -it backend-backend-1 bash
cd /app
alembic upgrade head

### 테이블 구조 변경 시 (models/ 폴더 수정 후)

1. 마이그레이션 파일 생성
docker exec -it backend-backend-1 bash
cd /app
alembic revision --autogenerate -m "변경 내용 설명"

2. DB에 적용
alembic upgrade head

3. git에 변경된 모델 파일 + alembic/versions/ 새 파일 같이 push

### 주의사항
- models/ 폴더 수정했는데 alembic 마이그레이션 안 만들면 DB랑 코드가 어긋남
- 마이그레이션 파일은 git에 반드시 포함 (versions/ 폴더 통째로)