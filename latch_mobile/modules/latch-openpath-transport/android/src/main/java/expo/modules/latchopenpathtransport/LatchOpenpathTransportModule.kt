package expo.modules.latchopenpathtransport

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LatchOpenpathTransportModule : Module() {
  private val transport = OpenpathHttp()

  override fun definition() = ModuleDefinition {
    Name("LatchOpenpathTransport")

    AsyncFunction("request") { handle: String, method: String, path: String, token: String?, json: String? ->
      transport.execute(handle, method, path, token, json)
    }

    Function("cancel") { handle: String -> transport.cancel(handle) }
    OnDestroy { transport.close() }
  }
}
