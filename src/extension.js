'use strict';
exports.__esModule = true;
var vscode = require("vscode");
var regexName = new RegExp(/(.*prototypes\\)/);
var regexPath = new RegExp(/(.*gsx.skets\\)/);
var regVersion = new RegExp(/(prototypeVersions\[.+\])/);
var documentPath = vscode.window.activeTextEditor.document.fileName;
var fileName = regexName[Symbol.split](documentPath);
fileName = fileName[2].slice(0, (fileName[2].length) - 3);
var gsxSkePath = regexPath[Symbol.split](documentPath);
gsxSkePath = gsxSkePath[1];
var fs = require('fs');
var protoInfo = fs.readFileSync(gsxSkePath + 'dist\\' + fileName + '.json', 'utf8');
protoInfo = JSON.parse(protoInfo);
var migrationPreview = "";
function activate(context) {
    console.log('Congratulations, your extension "Migration Check Tool" is now active!');
    var disposable = vscode.commands.registerCommand('extension.migrationPreview', function () {
        var protoName = protoInfo.Name;
        var protoServices = protoInfo.Services.Items;
        var protoAlerts = protoInfo.AlertProvider.AlertDefinitions.Items;
        var protoVariables = protoInfo.Variables.Items;
        var protoParameters = protoInfo.Params.Items;
        var protoWizardPages = protoInfo.WizardDialogs.Items[0].Pages.Items;
        migrationPreview += '\n\nPROTOTYPE: ' + protoName + "\n";
        for (var i = 0; i < protoServices.length; i++) {
            var service = protoServices[i];
            migrationPreview += "\n\n== " + service.Caption + " - Index [" + service.Index + "] - Variable: " + service.VariableName + "\n";
            var serviceScanComponents = service.ScanComponents.Items;
            migrationPreview += "\n\n\t== SCAN COMPONENTS\n";
            for (var j = 0; j < serviceScanComponents.length; j++) {
                var scanComponent = serviceScanComponents[j];
                migrationPreview += '\n\t\t' + scanComponent.Caption + ' - Index [' + scanComponent.Index + '] - Variable: "' + scanComponent.VariableName + '"';
            }
            var serviceTests = service.Tests.Items;
            migrationPreview += "\n\n\t== TESTS\n";
            for (var k = 0; k < serviceTests.length; k++) {
                var test = serviceTests[k];
                migrationPreview += "\n\t" + test.Caption + " - Index [" + test.Index + "] - Variable: \"" + test.VariableName + "\"";
            }
        }
        migrationPreview += "\n\n\t== ALERTS\n";
        for (var l = 0; l < protoAlerts.length; l++) {
            var alert = protoAlerts[l];
            migrationPreview += alert.Name + " - Index [" + alert.Index + "] - Condition: \"" + alert.Strategy.Condition + "\"";
        }
        migrationPreview += "\n\n\t== VARIABLES\n";
        for (var m = 0; m < protoVariables.length; m++) {
            var variable = protoVariables[m];
            migrationPreview += variable.Name + " - Index [" + variable.Index + "] - Expression: \"" + variable.EvaluationStrategy.Expression + "\"";
        }
        migrationPreview += "\n\n\t== PARAMETERS\n";
        for (var n = 0; n < protoParameters.length; n++) {
            var parameter = protoParameters[n];
            migrationPreview += parameter.Name + " - Index [" + parameter.Index + "] - Value: \"" + parameter.Value + "\"";
        }
        migrationPreview += "\n\n\t== WIZARD";
        for (var o = 0; o < protoWizardPages.length; o++) {
            var wizardPage = protoWizardPages[o];
            migrationPreview += parameter.Name + " - Index [" + parameter.Index + "] - Value: \"" + parameter.Value + "\"";
        }
        fs.appendFile(documentPath, migrationPreview, 'utf8', function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved");
        });
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map