mergeInto(LibraryManager.library, {
  // 웹 캡처 모드 (?kwShots=1): "[shot] 이름" 한 줄을 브라우저 콘솔에 그대로 (릴리스 빌드에서 Debug.Log 가 안 보일 수 있어서 직접)
  KwShotLog: function (ptr) {
    console.log(UTF8ToString(ptr));
  }
});
