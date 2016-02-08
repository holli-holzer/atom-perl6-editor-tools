"use babel"


let {BufferedProcess, CompositeDisposable} = require('atom')
let URL               = require('url')
PodPreviewView        = require('./pod-preview')
Perl6Linter           = require('./syntax-check-linter')
Perl6Builder          = require('./builder')
Perl6Hyperclick       = require('./help-hyperclick')

module.exports = {
  activate(state) {
    // Install package-deps section in package.json without user intervention
    require('atom-package-deps').install()
      .then( () => { console.log("All deps are installed, it's good to go") } )
      
    // Determine whether language-perl is enabled or not
    disabledPackages = atom.config.get("core.disabledPackages")
    enabled = true
    for(pkg of disabledPackages) {
      if (pkg == "language-perl") {
        enabled = false
        break;
      }
    }

    // Warn when language-perl is enabled!
    if (enabled) {
      atom.notifications.addWarning("Please disable language-perl for a better Perl 6 syntax highlighted code")
    }

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable

    // Register command that toggles this view
    this.subscriptions.add(
      atom.commands.add('atom-workspace', { 'main:pod-preview': () => { return module.exports.podPreview() } } )
    )

    atom.workspace.addOpener( (uriToOpen) => {
      let {protocol, host, pathname} = URL.parse(uriToOpen)

      if(protocol != 'pod-preview:') {
        return
      }

      try {
        if (pathname) {
          pathname = decodeURI(pathname) 
        }
      } catch(error) {
        console.error(error)
        return
      }

      if(host == 'editor') {
        return new PodPreviewView( { editorId: pathname.substring(1) } )
      } else {
        return new PodPreviewView( { filePath: pathname } )
      }
    })
  },

  run_tests() {
    // TODO take command from config parameter
    command   = 'prove'
    args      = ['-v', '-e', 'perl6']

    // TODO more robust detection of cwd
    options = {
      cwd: cwd = atom.project.getDirectories()[0].path,
      env: process.env
    }

    stdout  = (text) => {
      atom.notifications.addSuccess(text)
      return
    }

    stderr  = (text) => {
      atom.notifications.addError(text)
      return
    }

    exit    = (code) => {
      atom.notifications.addInfo(`'${command} ${args.join(" ")}' exited with ${code}`)
      return
    }

    // Run `prove -v -e "perl6 -Ilib"`
    atom.notifications.addInfo(`Starting running ${command} ${args.join(" ")}'...`)
    new BufferedProcess({command, args, options, stdout, stderr, exit})
  },

  podPreview() {
    // Open POD Preview on a valid editor and warn if otherwise
    editor = atom.workspace.getActiveTextEditor()
    if (!editor) {
      atom.notifications.addWarning("No editor found. Aborting...")
      return
    }

    // Open POD Preview only on a valid Perl6 editor and warn if otherwise
    grammar = editor.getGrammar()
    if (!  (grammar && grammar.scopeName && grammar.scopeName.startsWith("source.perl6")) ) {
      atom.notifications.addWarning("No Perl 6 editor found. Aborting...")
      return
    }

    // Open POD Preview only if Pod::To::HTML is installed and warn if otherwise
    module.exports.checkForPodToHtml( () => { module.exports.openPodPreview(editor) } )

    return
  },

  openPodPreview(editor) {
    // Double check that the editor is valid
    if(!editor) {
      return
    }

    uri = `pod-preview://editor/${editor.id}`

    previewPane = atom.workspace.paneForURI(uri)
    if(previewPane) {
      previewPane.destroyItem(previewPane.itemForURI(uri))
      return
    }

    previousActivePane = atom.workspace.getActivePane()
    atom.workspace.open(uri, { split: 'right', searchAllPanes: true} ).done( (podPreviewView) => {
      if (podPreviewView instanceof PodPreviewView) {
        podPreviewView.renderHTML()
        previousActivePane.activate()
      }
    });
  },

  deactivate: () => {
    this.subscriptions.dispose()
  },

  checkForPodToHtml(onSuccess) {
    // TODO take command from config parameter
    command   = 'perl6'
    args      = ["-e use Pod::To::HTML; 0"]

    exit    = (code) => {
      if (code == 0)
        onSuccess()
      else
        atom.notifications.addWarning("Pod::To::HTML is not installed. Aborting...")
      return
    }

    // Run perl6 -e 'use Pod::To::HTML'
    process   = new BufferedProcess({command, args, exit})
  },

  // Perl 6 linter
  provideLinter() {
    return new Perl6Linter
  },

  // Perl 6 builder
  provideBuilder() {
    return Perl6Builder
  },

  // Perl 6 context-sensitive help
  provideHyperclick() {
    return new Perl6Hyperclick
  }
}