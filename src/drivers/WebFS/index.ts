

class FsPlugin {

}


export default class FsFactory {
  create(): FsPlugin {
    return new FsPlugin();
  }

  load(name: string) {

  }
}
