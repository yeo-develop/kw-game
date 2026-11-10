mergeInto(LibraryManager.library, {
  KwCopyText: function (ptr) {
    var s = UTF8ToString(ptr);
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, s.length);
        document.execCommand('copy'); document.body.removeChild(ta);
      } catch (e) { console.warn('KwCopyText fallback failed', e); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).catch(fallback);
    else fallback();
  }
});
