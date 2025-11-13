using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Baklava
{
    // Uses reflection to find the FileTransformation plugin assembly and invoke
    // its RegisterTransformation method with a payload describing the file
    // pattern and callback to execute.
    internal static class TransformationRegistrar
    {
        private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);
        private const int MaxAttempts = 10;

        public static void Register()
        {
            // Fire-and-forget - run in background
            Task.Run(async () =>
            {
                for (int attempt = 1; attempt <= MaxAttempts; attempt++)
                {
                    try
                    {
                        PluginLogger.Log($"Attempting transformation registration (attempt {attempt}/{MaxAttempts})");

                        if (TryRegister())
                        {
                            PluginLogger.Log("Transformation registration succeeded.");
                            return;
                        }
                        else
                        {
                            PluginLogger.Log("Transformation plugin not found yet; will retry.");
                        }
                    }
                    catch (Exception ex)
                    {
                        PluginLogger.Log("Exception while attempting registration: " + ex);
                    }

                    await Task.Delay(RetryDelay).ConfigureAwait(false);
                }
                // If we reach here, we failed to find a FileTransformation plugin.
                // As a last resort attempt an in-place injection into the web root
                // if the process has permissions to do so. This mirrors the direct
                // injection fallback other plugins use.
                try
                {
                    PluginLogger.Log("FileTransformation plugin not found after retries — attempting direct injection into web root.");
                    TryDirectInjectIntoWebRoot();
                }
                catch (Exception ex)
                {
                    PluginLogger.Log("Direct injection attempt failed: " + ex);
                }
            });
        }

        private static void TryDirectInjectIntoWebRoot()
        {
            try
            {
                PluginLogger.Log("Direct injection fallback is not implemented - FileTransformation plugin should handle this.");
            }
            catch (Exception ex)
            {
                PluginLogger.Log("Exception during direct injection: " + ex);
            }
        }

        private static void InspectRegistrations(Type pluginInterfaceType, string pattern)
        {
            try
            {
                PluginLogger.Log("Inspecting FileTransformation.PluginInterface for registrations...");

                // Look for static fields or properties that look like collections of registrations
                var members = pluginInterfaceType.GetMembers(BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
                foreach (var m in members)
                {
                    try
                    {
                        object val = null;
                        if (m is FieldInfo f)
                        {
                            val = f.GetValue(null);
                        }
                        else if (m is PropertyInfo p && p.GetIndexParameters().Length == 0)
                        {
                            val = p.GetValue(null);
                        }

                        if (val == null) continue;

                        // If it's enumerable, inspect elements for a pattern or id
                        if (val is System.Collections.IEnumerable en)
                        {
                            int idx = 0;
                            foreach (var item in en)
                            {
                                try
                                {
                                    var it = item;
                                    var itType = it.GetType();
                                    var fnProp = itType.GetProperty("fileNamePattern") ?? itType.GetProperty("FileNamePattern") ?? itType.GetProperty("pattern");
                                    var cbAsm = itType.GetProperty("callbackAssembly") ?? itType.GetProperty("CallbackAssembly");
                                    var cbClass = itType.GetProperty("callbackClass") ?? itType.GetProperty("CallbackClass");
                                    var cbMethod = itType.GetProperty("callbackMethod") ?? itType.GetProperty("CallbackMethod");

                                    var fn = fnProp?.GetValue(it) as string;
                                    var asm = cbAsm?.GetValue(it) as string;
                                    var cls = cbClass?.GetValue(it) as string;
                                    var mth = cbMethod?.GetValue(it) as string;

                                    if (!string.IsNullOrEmpty(fn) && fn.Contains(pattern ?? string.Empty))
                                    {
                                        PluginLogger.Log($"Found registration in member '{m.Name}' index {idx}: pattern='{fn}', asm='{asm}', class='{cls}', method='{mth}'");
                                        return;
                                    }
                                }
                                catch { }
                                idx++;
                            }
                        }
                    }
                    catch { }
                }

                PluginLogger.Log("No matching registration entry was found during inspection.");
            }
            catch (Exception ex)
            {
                PluginLogger.Log("Error while inspecting registrations: " + ex);
            }
        }

    private static bool TryRegister()
        {
            // Try direct compile-time API call if the FileTransformation assembly is available in the current AppDomain
            try
            {
                var ftType = AppDomain.CurrentDomain.GetAssemblies()
                    .Select(a => a.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface", false))
                    .FirstOrDefault(tt => tt != null);

                if (ftType != null)
                {
                    PluginLogger.Log("Found FileTransformation.PluginInterface, attempting direct registration...");
                    
                    // Find Newtonsoft.Json assembly
                    var newtonsoft = AppDomain.CurrentDomain.GetAssemblies()
                        .FirstOrDefault(a => a.GetName().Name == "Newtonsoft.Json");
                    
                    if (newtonsoft != null)
                    {
                        PluginLogger.Log("Found Newtonsoft.Json assembly");
                        
                        var jObjectType = newtonsoft.GetType("Newtonsoft.Json.Linq.JObject");
                        if (jObjectType != null)
                        {
                            PluginLogger.Log("Found JObject type, preparing payload...");
                            
                            var assemblyFullName = Assembly.GetExecutingAssembly().FullName;
                            var classFullName = typeof(FileTransformations).FullName;
                            var methodName = nameof(FileTransformations.Transform);
                            
                            PluginLogger.Log($"REGISTRATION DETAILS: Assembly='{assemblyFullName}', Class='{classFullName}', Method='{methodName}'");
                            
                            var payloadDictDirect = new Dictionary<string, object>
                            {
                                ["id"] = Guid.NewGuid(),
                                ["fileNamePattern"] = "index.html",
                                ["callbackAssembly"] = assemblyFullName,
                                ["callbackClass"] = classFullName,
                                ["callbackMethod"] = methodName
                            };

                            // Try to convert to JObject using FromObject
                            var fromObjectMethods = jObjectType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                                .Where(m => m.Name == "FromObject")
                                .ToArray();
                            
                            PluginLogger.Log($"Found {fromObjectMethods.Length} FromObject methods");
                            
                            var fromObject = fromObjectMethods.FirstOrDefault(m => m.GetParameters().Length == 1);
                            if (fromObject != null)
                            {
                                PluginLogger.Log("Converting payload to JObject...");
                                var payloadObjDirect = fromObject.Invoke(null, new object[] { payloadDictDirect });
                                PluginLogger.Log($"Payload converted, type: {payloadObjDirect?.GetType().FullName ?? "null"}");
                                
                                var registerMi = ftType.GetMethod("RegisterTransformation", BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
                                if (registerMi != null)
                                {
                                    PluginLogger.Log($"Found RegisterTransformation method, IsStatic: {registerMi.IsStatic}");
                                    
                                    object targetDirect = null;
                                    if (!registerMi.IsStatic)
                                    {
                                        targetDirect = Activator.CreateInstance(ftType);
                                        PluginLogger.Log("Created instance of PluginInterface");
                                    }
                                    
                                    PluginLogger.Log("Invoking RegisterTransformation...");
                                    registerMi.Invoke(targetDirect, new object[] { payloadObjDirect });
                                    PluginLogger.Log("Invoked transformation registration successfully (direct API).");
                                    try { InspectRegistrations(ftType, "index.html"); } catch { }
                                    return true;
                                }
                                else
                                {
                                    PluginLogger.Log("ERROR: RegisterTransformation method not found");
                                }
                            }
                            else
                            {
                                PluginLogger.Log("ERROR: Could not find suitable FromObject method");
                            }
                        }
                        else
                        {
                            PluginLogger.Log("ERROR: JObject type not found in Newtonsoft.Json");
                        }
                    }
                    else
                    {
                        PluginLogger.Log("ERROR: Newtonsoft.Json assembly not found");
                    }
                }
            }
            catch (Exception ex)
            {
                PluginLogger.Log("Direct API registration attempt failed: " + ex);
            }

            // Fallback: try to locate via reflection as before
            var asm = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => (a.FullName ?? string.Empty).Contains("FileTransformation", StringComparison.OrdinalIgnoreCase)
                                     || (a.GetName().Name ?? string.Empty).Contains("FileTransformation", StringComparison.OrdinalIgnoreCase));

            if (asm == null)
            {
                return false;
            }
            // Look for a type called PluginInterface or similar
            var t = asm.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface")
                    ?? asm.GetTypes().FirstOrDefault(x => x.Name.IndexOf("PluginInterface", StringComparison.OrdinalIgnoreCase) >= 0);

            if (t == null)
            {
                PluginLogger.Log("Found FileTransformation assembly but could not find a PluginInterface type.");
                return false;
            }

            // Candidate method names we may try
            var candidateNames = new[] { "RegisterTransformation", "RegisterFileTransformation", "RegisterTransform", "AddTransformation" };

            MethodInfo mi = null;
            string usedName = null;
            foreach (var name in candidateNames)
            {
                mi = t.GetMethod(name, BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
                if (mi != null)
                {
                    usedName = name;
                    break;
                }
            }

            if (mi == null)
            {
                PluginLogger.Log($"Could not find any Register method on type {t.FullName}. Tried: {string.Join(',', candidateNames)}");
                return false;
            }

            PluginLogger.Log($"Found registration method '{usedName}' on {t.FullName}. Preparing payload...");

            // Build payload describing the transformation as a Dictionary first
            var payloadDict = new Dictionary<string, object>
            {
                ["id"] = Guid.NewGuid(),
                // Use a simple filename match that other plugins use (index.html)
                ["fileNamePattern"] = "index.html",
                ["callbackAssembly"] = Assembly.GetExecutingAssembly().FullName,
                ["callbackClass"] = typeof(FileTransformations).FullName,
                ["callbackMethod"] = nameof(FileTransformations.Transform)
            };

            // The FileTransformation plugin expects a Newtonsoft.Json.Linq.JObject.
            // Convert the dictionary to a JObject at runtime via reflection if available
            object payload = payloadDict;
            try
            {
                // First, try to find Newtonsoft.Json assembly
                var newtonsoftAsm = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == "Newtonsoft.Json");
                
                if (newtonsoftAsm != null)
                {
                    PluginLogger.Log("Found Newtonsoft.Json assembly, attempting JObject conversion...");
                    
                    var jObjType = newtonsoftAsm.GetType("Newtonsoft.Json.Linq.JObject");
                    if (jObjType != null)
                    {
                        PluginLogger.Log("Found JObject type, looking for FromObject method...");
                        
                        // Try different overloads of FromObject
                        var fromObject = jObjType.GetMethod("FromObject", 
                            BindingFlags.Public | BindingFlags.Static, 
                            null, 
                            new[] { typeof(object) }, 
                            null);
                        
                        if (fromObject == null)
                        {
                            // Try with JsonSerializerSettings parameter
                            var methods = jObjType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                                .Where(m => m.Name == "FromObject")
                                .ToArray();
                            
                            PluginLogger.Log($"Found {methods.Length} FromObject methods");
                            
                            fromObject = methods.FirstOrDefault(m => m.GetParameters().Length == 1);
                        }
                        
                        if (fromObject != null)
                        {
                            PluginLogger.Log("Invoking JObject.FromObject...");
                            payload = fromObject.Invoke(null, new object[] { payloadDict });
                            PluginLogger.Log("Successfully converted registration payload to JObject via FromObject.");
                        }
                        else
                        {
                            PluginLogger.Log("ERROR: Could not find suitable FromObject method on JObject type");
                        }
                    }
                    else
                    {
                        PluginLogger.Log("ERROR: Could not find JObject type in Newtonsoft.Json assembly");
                    }
                }
                else
                {
                    PluginLogger.Log("WARNING: Newtonsoft.Json assembly not found - payload will be Dictionary");
                }
            }
            catch (Exception ex)
            {
                PluginLogger.Log("Failed to convert payload to JObject: " + ex);
                PluginLogger.Log("Exception details: " + ex.Message);
                PluginLogger.Log("Stack trace: " + ex.StackTrace);
                payload = payloadDict; // fallback
            }

            // Invoke RegisterTransformation - could be static or instance method
            object target = null;
            if (!mi.IsStatic)
            {
                try
                {
                    target = Activator.CreateInstance(t);
                }
                catch (Exception ex)
                {
                    PluginLogger.Log("Failed to instantiate PluginInterface type: " + ex);
                    return false;
                }
            }

            try
            {
                mi.Invoke(target, new object[] { payload });
                PluginLogger.Log("Invoked transformation registration successfully.");

                // Try to inspect the PluginInterface type for any registration collections
                try
                {
                    InspectRegistrations(t, payloadDict["fileNamePattern"] as string);
                }
                catch (Exception iex)
                {
                    PluginLogger.Log("Inspection of FileTransformation registrations failed: " + iex);
                }
                return true;
            }
            catch (TargetInvocationException tie)
            {
                // Unwrap common invocation exceptions for clearer logs
                PluginLogger.Log("Exception while invoking registration method: " + (tie.InnerException ?? tie));
                return false;
            }
            catch (Exception ex)
            {
                PluginLogger.Log("Exception while invoking registration method: " + ex);
                return false;
            }
        }
    }
}
