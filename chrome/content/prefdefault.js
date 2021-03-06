// Properties below will bind to the element in the prefWindow with the same id
// Don't use 'Name' as the name of the new preference
var PrefDefaults = {
    'Name': 'default',
    'Encoding': (window.navigator.language == 'zh-CN' ? 'gb2312' : 'big5'),
    'Cols': 80,
    'Rows': 24,
    'HAlignCenter': true,
    'VAlignCenter': true,
    'DetectDBCS': true,
    'ShowConnTimer': false,
    'Beep': false,
    'Popup': true,
    'MouseBrowsing': 0,
    'AskForClose': false,
    'AntiIdleTime': 180,
    'AntiIdleStr': '^[[A^[[B',
    'ReconnectTime': 15,
    'ReconnectDelay': 0,
    'ReconnectCount': 100,
    'PreLoginPrompt': '',
    'PreLogin': '',
    'LoginPrompt': '',
    'Login': '',
    'PasswdPrompt': '',
    'Passwd': '',
    'PostLogin': '',
    'ReplyPrompt0': '',
    'ReplyString0': '',
    'ReplyPrompt1': '',
    'ReplyString1': '',
    'ReplyPrompt2': '',
    'ReplyString2': '',
    'ReplyPrompt3': '',
    'ReplyString3': '',
    'ReplyPrompt4': '',
    'ReplyString4': '',
    'ClearCopiedSel': true,
    'CopyAfterSel': false,
    'PasteAsMidClick': false,
    'KeepSelAtBufUpd': false,
    'TrimTail': true,
    'LineWrap': 78,
    'EscapeString': '^U',
    'TermType': 'VT100',
    'EnterKey': '^M',
    'LineFeed': true,
    'NewTab': false
}

// the value of an element corresponds to the property of nsILoginInfo
var PrefLoginMgr = {
    'Login': 'username',
    'Passwd': 'password'
}
