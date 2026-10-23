export type Locale = 'mk' | 'en';

const catalogs = {
  mk: {
    appName: 'Паркирај',
    signedInAs: 'Најавен како',
    laterPermissions: 'Дозволи за подоцна',
    location: 'Локација (секогаш)',
    motion: 'Движење и фитнес',
    notifications: 'Известувања',
    logOut: 'Одјави се',
    back: 'Назад',
    logIn: 'Најава',
    loggingIn: 'Се најавува…',
    email: 'Е-пошта',
    password: 'Лозинка',
    createAccount: 'Создај сметка',
    forgotPassword: 'Заборавена лозинка',
    register: 'Регистрација',
    username: 'Корисничко име',
    creatingAccount: 'Се создава сметка…',
    alreadyHaveAccount: 'Веќе имам сметка',
    sending: 'Се испраќа…',
    sendReset: 'Испрати линк за ресетирање',
    macedonian: 'Македонски',
    english: 'English',
    forgotPasswordHelp:
      'Внесете ја е-поштата за вашата сметка.',
    explainLocation:
      'Подоцнежна верзија ќе побара локација поставена на Секогаш, за апликацијата да може да забележи кога паркирате во платена зона, дури и кога апликацијата е во заднина. На овој екран сè уште нема барање.',
    explainMotion:
      'Подоцнежна верзија ќе користи движење и фитнес за да разликува возење од одење или стоење, за попрецизно откривање паркирање. Овој екран сè уште не пристапува до податоци за движење.',
    explainNotifications:
      'Подоцнежна верзија ќе испраќа локални известувања кога можеби сте заборавиле да платите паркирање. Засега се планирани само известувања на уредот. Овде сè уште не се бара дозвола за известувања.',
  },
  en: {
    appName: 'ParkPay',
    signedInAs: 'Signed in as',
    laterPermissions: 'Later permissions',
    location: 'Location (Always)',
    motion: 'Motion and Fitness',
    notifications: 'Notifications',
    logOut: 'Log out',
    back: 'Back',
    logIn: 'Log in',
    loggingIn: 'Logging in…',
    email: 'Email',
    password: 'Password',
    createAccount: 'Create an account',
    forgotPassword: 'Forgot password',
    register: 'Register',
    username: 'Username',
    creatingAccount: 'Creating account…',
    alreadyHaveAccount: 'Already have an account',
    sending: 'Sending…',
    sendReset: 'Send reset link',
    macedonian: 'Македонски',
    english: 'English',
    forgotPasswordHelp: 'Enter the email address for your account.',
    explainLocation:
      'A later version will ask for Location set to Always so the app can notice when you park in a paid zone, even when the app is in the background. Nothing is requested on this screen yet.',
    explainMotion:
      'A later version will use Motion and Fitness to tell driving apart from walking or standing still, so parking detection is more reliable. This screen does not access motion data yet.',
    explainNotifications:
      'A later version will send local notifications when you may have forgotten to pay for parking. Only on-device alerts are planned for now. No notification permission is requested here yet.',
  },
} as const;

export type TranslationKey = keyof typeof catalogs.mk;

export function translate(locale: Locale, key: TranslationKey): string {
  return catalogs[locale][key];
}
