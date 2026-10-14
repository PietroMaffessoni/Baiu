// Esconde o conteúdo do Baiu na tela de apps recentes do Android, como a
// cortina faz no iPhone, sem bloquear as capturas de tela do próprio usuário.
//
// Android 13 ou mais novo: setRecentsScreenshotEnabled(false) troca a miniatura
// do app em Recentes por uma tela vazia. Capturas de tela continuam permitidas.
// Android 12 ou mais antigo: não existe essa opção, então a janela recebe
// FLAG_SECURE só enquanto o app está pausado e perde a flag ao voltar.
const { withMainActivity } = require('expo/config-plugins');

const MARK = '// baiu:recents-privacy';

function addImport(src, line) {
  if (src.includes(line)) return src;
  return src.replace(/^(package [^\n]+\n)/, `$1\n${line}\n`);
}

function transform(src) {
  if (src.includes(MARK)) return src;
  if (!/class MainActivity\s*:\s*ReactActivity\(\)\s*\{/.test(src) || !src.includes('super.onCreate(')) {
    throw new Error('with-recents-privacy: MainActivity.kt em formato inesperado');
  }
  let out = addImport(src, 'import android.os.Build');
  out = addImport(out, 'import android.view.WindowManager');
  out = out.replace(
    /(super\.onCreate\([^)]*\);?)/,
    `$1
    ${MARK}
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(false)
    }`,
  );
  out = out.replace(
    /(class MainActivity\s*:\s*ReactActivity\(\)\s*\{)/,
    `$1
  ${MARK}
  override fun onPause() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }
`,
  );
  return out;
}

const withRecentsPrivacy = (config) =>
  withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('with-recents-privacy: só MainActivity em Kotlin é suportada');
    }
    cfg.modResults.contents = transform(cfg.modResults.contents);
    return cfg;
  });

module.exports = withRecentsPrivacy;
module.exports.transform = transform;
