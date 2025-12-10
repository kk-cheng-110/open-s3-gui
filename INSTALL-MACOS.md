# macOS 安装说明

## 解决 "应用已损坏" 问题

如果在 macOS 上安装 Open S3 后遇到 **"Open S3" is damaged and can't be opened. You should move it to the Trash.** 提示，这是因为应用未经过苹果的代码签名认证导致的。

### 解决方法

**方法 1：通过终端移除隔离属性（推荐）**

1. 打开终端（Terminal）
2. 执行以下命令：
   ```bash
   xattr -cr /Applications/Open\ S3.app
   ```
3. 再次打开应用即可

**方法 2：通过系统设置允许**

1. 右键点击 Open S3 应用
2. 选择"打开"
3. 在弹出的对话框中点击"打开"按钮

### 为什么会出现这个问题？

macOS 的 Gatekeeper 安全机制会阻止运行未经苹果认证的应用。Open S3 是开源免费软件，未购买苹果开发者证书进行代码签名，因此会触发此限制。

### 安全性说明

Open S3 是完全开源的项目，您可以在 GitHub 上查看所有源代码。应用本身是安全的，只是未经过苹果的付费认证流程。
