using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Tasks;

namespace Baklava.Services
{
    public class StartupService : IScheduledTask
    {
        public string Name => "Baklava Startup";
        public string Key => "Baklava.Startup";
        public string Description => "Registers file transformations for Baklava";
        public string Category => "Startup Services";

        public async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                try
                {
                    PluginLogger.Log("StartupService: Executing, will register transformations");
                    TransformationRegistrar.Register();
                }
                catch (Exception ex)
                {
                    PluginLogger.Log($"StartupService error: {ex.Message}");
                }
            }, cancellationToken);
        }

        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
        {
            yield return new TaskTriggerInfo
            {
                Type = TaskTriggerInfoType.StartupTrigger
            };
        }
    }
}
