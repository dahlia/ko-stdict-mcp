ko-stdict-mcp
=============

《표준국어대사전》 공식 “사전 내려받기” JSON 덤프를 내려받아 SQLite로 정규화한
뒤 MCP 도구로 조회하는 Deno 서버입니다.


특징
----

 -  국립국어원 Open API 키 없이 동작
 -  최초 기동 시 공식 JSON 덤프 다운로드 및 SQLite 초기화
 -  이후에는 로컬 ZIP 캐시와 정규화된 DB 재사용
 -  표제어 중심 검색
 -  조회 시 필요한 필드만 선택 가능
 -  Deno 기반 stdio MCP 서버


요구 사항
---------

 -  Deno 2.0 이상


설치
----

~~~~ bash
deno install
~~~~


실행
----

~~~~ bash
deno task dev
~~~~

초기 데이터만 준비하려면:

~~~~ bash
deno task init
~~~~

강제로 새 덤프를 받아 다시 구성하려면:

~~~~ bash
deno task refresh
~~~~


MCP 클라이언트 설정 예시
------------------------

~~~~ json
{
  "mcpServers": {
    "ko-stdict": {
      "command": "deno",
      "args": [
        "run",
        "-A",
        "jsr:@hongminhee/ko-stdict-mcp"
      ]
    }
  }
}
~~~~

로컬 체크아웃 기준 예시:

~~~~ json
{
  "mcpServers": {
    "ko-stdict": {
      "command": "deno",
      "args": [
        "run",
        "-A",
        "/absolute/path/to/ko-stdict-mcp/main.ts"
      ]
    }
  }
}
~~~~


데이터 위치
-----------

기본 경로:

 -  Linux/macOS: `${XDG_DATA_HOME:-$HOME/.local/share}/ko-stdict-mcp`

환경 변수로 변경 가능:

 -  `KO_STDICT_DATA_DIR`


제공 도구
---------

 -  `search_entries`: 표제어 exact/prefix/contains 검색
 -  `get_entry`: `target_code` 기반 상세 조회
 -  `dictionary_status`: 로컬 데이터 상태 조회
 -  `refresh_dictionary`: 공식 덤프를 다시 받아 DB 갱신


필드 선택 예시
--------------

기본 응답 필드:

 -  `target_code`
 -  `word`
 -  `hanja`
 -  `sup_no`
 -  `pos`
 -  `definition`

예를 들어 표제어와 뜻풀이만 원하면:

~~~~ json
{
  "query": "나무",
  "fields": ["word", "definition"]
}
~~~~


개발
----

~~~~ bash
deno task check
deno task test
~~~~


라이선스
--------

[AGPL 3.0] 또는 이후 버전으로 배포됩니다.

[AGPL 3.0]: https://www.gnu.org/licenses/agpl-3.0.html


원천 데이터
-----------

이 프로젝트는 국립국어원 《표준국어대사전》 사이트의 공식 “사전 내려받기”
기능으로 제공되는 덤프 데이터를 사용합니다. 데이터의 저작권과 이용 조건은 원
제공처 정책을 따릅니다.
