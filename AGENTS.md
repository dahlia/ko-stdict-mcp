저장소 작업 지침
================

실행 환경
---------

 -  Deno 2.7.9 이상을 사용합니다.
 -  패키지는 JSR 배포를 염두에 두고 유지합니다.
 -  런타임 권한은 기본적으로 `-A`를 전제하지만, 코드에서는 필요한 파일/네트워크
    접근 범위를 명확히 유지합니다.


명령어
------

 -  개발 서버: `deno task dev`
 -  초기화만 실행: `deno task init`
 -  강제 갱신: `deno task refresh`
 -  포맷 검사: `deno fmt --check`
 -  린트: `deno lint`
 -  테스트: `deno test -A`
 -  전체 확인: `deno task check`


데이터 취급
-----------

 -  공식 덤프 ZIP과 SQLite DB는 저장소에 커밋하지 않습니다.
 -  로컬 데이터는 `KO_STDICT_DATA_DIR` 또는 기본 데이터 디렉터리 아래에만 둡니다.
 -  테스트에서는 축약 fixture ZIP만 사용합니다.


코드 규칙
---------

 -  모듈은 기능별로 분리하고, 공개 API는 `mod.ts`에서만 재수출합니다.
 -  MCP 도구 입력/출력 스키마는 Zod로 고정합니다.
 -  SQLite 스키마 변경 시 `SCHEMA_VERSION`을 올리고 마이그레이션 또는 재생성 경로를
    같이 수정합니다.


검증
----

 -  기능 변경 후 최소 `deno fmt --check`, `deno lint`, `deno test -A`를
    통과시킵니다.
 -  외부 네트워크에 의존하는 테스트는 로컬 HTTP fixture 서버로 대체합니다.
