import './styles.css';

const ReactApi = window.React;
const element = (tag) => ReactApi.forwardRef(function AcademyElement({children, ...props}, ref) {
  return ReactApi.createElement(tag, {...props, ref}, children);
});

export const A = element('a');
export const Article = element('article');
export const Button = element('button');
export const Div = element('div');
export const Footer = element('footer');
export const Form = element('form');
export const H1 = element('h1');
export const H2 = element('h2');
export const H3 = element('h3');
export const Header = element('header');
export const Input = element('input');
export const Label = element('label');
export const Li = element('li');
export const Main = element('main');
export const Nav = element('nav');
export const Option = element('option');
export const P = element('p');
export const Progress = element('progress');
export const Section = element('section');
export const Select = element('select');
export const Span = element('span');
export const Strong = element('strong');
export const Ul = element('ul');

const forbiddenHtmlTags = new Set([
  'script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'portal', 'form', 'input', 'textarea', 'select', 'button', 'style', 'link', 'meta',
  'base', 'body', 'head', 'html', 'title', 'svg', 'math', 'audio', 'video', 'source',
  'track', 'canvas', 'details', 'dialog', 'plaintext', 'xmp', 'listing', 'marquee',
  'noframes', 'noembed', 'template', 'slot'
]);

function sanitizeHtml(content) {
  const template = document.createElement('template');
  template.innerHTML = String(content);

  for (const node of template.content.querySelectorAll('*')) {
    if (forbiddenHtmlTags.has(node.tagName.toLowerCase())) {
      node.remove();
      continue;
    }

    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['action', 'formaction', 'srcdoc', 'style', 'xlink:href'].includes(name)) {
        node.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'href' || name === 'src') {
        try {
          const url = new URL(attribute.value, window.location.origin);
          const allowed = name === 'href'
            ? ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
            : ['http:', 'https:'].includes(url.protocol);
          if (!allowed) node.removeAttribute(attribute.name);
        } catch {
          node.removeAttribute(attribute.name);
        }
      }
    }

    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return template.innerHTML;
}

export function HtmlContent({content = '', isHtml = true, className = ''}) {
  const actualContent = String(content ?? '');
  const sanitizedHtml = ReactApi.useMemo(
    () => isHtml ? sanitizeHtml(actualContent) : '',
    [actualContent, isHtml]
  );

  if (!actualContent.trim()) return null;

  if (!isHtml) {
    return ReactApi.createElement('div', {className}, actualContent);
  }

  return ReactApi.createElement('div', {
    className,
    dangerouslySetInnerHTML: {__html: sanitizedHtml}
  });
}

export function ThemeToggle({label = 'Theme'}) {
  const [scheme, setScheme] = ReactApi.useState(() => window.localStorage.getItem('g7_color_scheme') || 'auto');
  const [systemDark, setSystemDark] = ReactApi.useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  ReactApi.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemDark(event.matches);
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);
  ReactApi.useEffect(() => {
    const dark = scheme === 'dark' || (scheme === 'auto' && systemDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    window.localStorage.setItem('g7_color_scheme', scheme);
  }, [scheme, systemDark]);
  const next = scheme === 'auto' ? 'light' : scheme === 'light' ? 'dark' : 'auto';
  const icon = (scheme === 'dark' || (scheme === 'auto' && systemDark)) ? '☾' : '☀';
  return ReactApi.createElement('button', {
    type: 'button',
    className: 'glitter-learning-academy-theme-toggle',
    onClick: () => setScheme(next),
    'aria-label': label,
    title: label,
    'data-theme-scheme': scheme
  }, ReactApi.createElement('span', {'aria-hidden': 'true'}, icon));
}

export function AccountMenu({
  user = null,
  accountLabel = '',
  memberLabel = '',
  adminLabel = '',
  profileLabel = '',
  adminMenuLabel = '',
  logoutLabel = '',
  loginLabel = '',
  loginPath = '/login',
  profilePath = '/mypage/profile',
  learningPath = '/learning/me',
  adminPath = '/admin'
}) {
  const [open, setOpen] = ReactApi.useState(false);
  const authManager = window.G7Core?.AuthManager?.getInstance?.();
  const hasAuthManager = Boolean(authManager);
  const [authState, setAuthState] = ReactApi.useState(() => authManager?.getState?.() ?? {
    isAuthenticated: Boolean(user?.uuid),
    user: user || null
  });
  const triggerRef = ReactApi.useRef(null);
  const menuRef = ReactApi.useRef(null);

  ReactApi.useEffect(() => {
    if (!authManager) return undefined;
    setAuthState(authManager.getState());
    return authManager.on('authStateChange', (state) => {
      setAuthState(state);
      if (!state.isAuthenticated) setOpen(false);
    });
  }, [authManager]);

  ReactApi.useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    menuRef.current?.querySelector('a,button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentUser = hasAuthManager ? authState.user : user;
  const isAuthenticated = hasAuthManager ? authState.isAuthenticated : Boolean(user?.uuid);
  if (!isAuthenticated || !currentUser?.uuid) {
    return ReactApi.createElement('a', {
      className: 'glitter-learning-academy-account-login glitter-learning-academy-button glitter-learning-academy-button--secondary',
      href: loginPath
    }, loginLabel);
  }

  const displayName = currentUser.nickname || currentUser.name || memberLabel;
  const initial = String(displayName || memberLabel).trim().slice(0, 1).toUpperCase();
  const avatar = currentUser.avatar
    ? ReactApi.createElement('img', {src: currentUser.avatar, alt: '', className: 'glitter-learning-academy-account-avatar'})
    : ReactApi.createElement('span', {'aria-hidden': 'true', className: 'glitter-learning-academy-account-avatar'}, initial || '•');
  const closeAfterNavigate = () => setOpen(false);
  const handleLogout = async () => {
    setOpen(false);
    if (authManager) await authManager.logout();
  };

  return ReactApi.createElement('div', {className: 'glitter-learning-academy-account-menu', ref: menuRef},
    ReactApi.createElement('button', {
      type: 'button',
      ref: triggerRef,
      className: 'glitter-learning-academy-account-trigger',
      'aria-label': accountLabel,
      'aria-expanded': open,
      'aria-controls': 'glitter-learning-academy-account-dropdown',
      'aria-haspopup': 'menu',
      onClick: () => setOpen((value) => !value)
    }, avatar, ReactApi.createElement('span', {className: 'glitter-learning-academy-account-name'}, displayName), ReactApi.createElement('span', {'aria-hidden': 'true', className: 'glitter-learning-academy-account-chevron'}, '▾')),
    open && ReactApi.createElement('div', {id: 'glitter-learning-academy-account-dropdown', className: 'glitter-learning-academy-account-dropdown', role: 'menu', 'aria-label': accountLabel},
      ReactApi.createElement('div', {className: 'glitter-learning-academy-account-summary'}, avatar, ReactApi.createElement('div', null, ReactApi.createElement('strong', null, displayName), ReactApi.createElement('span', {className: 'glitter-learning-academy-account-role'}, currentUser.is_admin === true ? adminLabel : memberLabel))),
      ReactApi.createElement('div', {className: 'glitter-learning-academy-account-divider', role: 'separator'}),
      currentUser.is_admin === true && ReactApi.createElement('a', {href: adminPath, role: 'menuitem', onClick: closeAfterNavigate}, ReactApi.createElement('span', {'aria-hidden': 'true', className: 'glitter-learning-academy-account-item-icon'}, '⚙'), ReactApi.createElement('span', null, adminMenuLabel)),
      ReactApi.createElement('a', {href: profilePath, role: 'menuitem', onClick: closeAfterNavigate}, ReactApi.createElement('span', {'aria-hidden': 'true', className: 'glitter-learning-academy-account-item-icon'}, '👤'), ReactApi.createElement('span', null, profileLabel)),
      ReactApi.createElement('div', {className: 'glitter-learning-academy-account-divider', role: 'separator'}),
      ReactApi.createElement('button', {type: 'button', role: 'menuitem', className: 'glitter-learning-academy-account-logout', onClick: handleLogout}, ReactApi.createElement('span', {'aria-hidden': 'true', className: 'glitter-learning-academy-account-item-icon'}, '↪'), ReactApi.createElement('span', null, logoutLabel))
    )
  );
}

export function Toast({toasts = []}) {
  return ReactApi.createElement('div', {className: 'glitter-learning-academy-toasts', role: 'status', 'aria-live': 'polite'},
    (Array.isArray(toasts) ? toasts : []).map((toast, index) => ReactApi.createElement('div', {
      className: `glitter-learning-academy-toast glitter-learning-academy-toast--${toast.type || 'info'}`,
      key: toast.id || index
    }, toast.message || toast.title || '')));
}

export const templateMetadata = {identifier: 'glitter-learning_academy', name: 'Glitter Learning Academy', version: '1.0.0'};
