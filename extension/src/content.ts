function isLoginOrVerificationPage(): boolean {
  // Boss 会把未展示的登录弹窗长期留在已登录页面的 DOM 中，因此不能只凭
  // body.innerText 中出现“扫码登录”等字样判断。已登录导航链接是更可靠的信号。
  const hasSignedInNavigation = Boolean(document.querySelector(
    'a[href*="/web/geek/chat"], a[href*="/web/geek/resume"], a[href*="/web/geek/recommend"]',
  ));
  if (hasSignedInNavigation) return false;

  const urlRequiresLogin = /login|security-check|verify|captcha|\/web\/user\//i.test(location.href);
  const loginPageClass = document.body.classList.contains("login-page");
  const visibleVerificationText = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    })
    .some((element) => /请完成安全验证|完成验证|请输入验证码/.test(element.innerText));

  return urlRequiresLogin || loginPageClass || visibleVerificationText;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "snapshot") return false;
  sendResponse({
    url: location.href,
    title: document.title,
    isLoginOrVerification: isLoginOrVerificationPage(),
    html: document.documentElement.outerHTML,
  });
  return false;
});
