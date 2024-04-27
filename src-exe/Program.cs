using System.Diagnostics;

var app = new ProcessStartInfo
{
    FileName = "powershell",
    Arguments = @"/c start-process powershell -ArgumentList "".\node-v20.12.2-win-x64\node.exe"","".\src\app.js""",
};
Process.Start(app);
