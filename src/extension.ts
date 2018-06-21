'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { TextDocument } from 'vscode';

const fs = require('fs');
const changeCase = require('change-case');

function sanitizeFragmentName(fragmentName) {
    var string = "";
    for (var i = 0; i < fragmentName.length; i++) {
        if (i > 0 && /[A-Z]/.test(fragmentName[i])) {
            string += " " + fragmentName[i];
        } else if (fragmentName[i] === ".") {
            string += '';
        } else {
            string += fragmentName[i];
        }
    }
    string = string.replace('Gsx Ske Views View', '')
        .replace(',  Gsx Ske Viewsdll', '')
        .trim();
    return string;
}

function getFragmentLabel(wizardPageElement: any) {
    var label = '';
    if (wizardPageElement.Config) {
        var configArray = Object.keys(wizardPageElement.Config);
        for (var i = 0; i < configArray.length; i++) {
            if (/([Ll]abel)/.test(configArray[i]) || /(ButtonText)/.test(configArray[i])) {
                label = wizardPageElement.Config[configArray[i]];
                return label;
            }
        }
    }
    return label;
}

function comparePosition(a, b) {
    const positionA = a.Position;
    const positionB = b.Position;
    let comparison = 0;
    if (positionA > positionB) {
      comparison = 1;
    } else if (positionA < positionB) {
      comparison = -1;
    }
    return comparison;
}

function compare(a, b) {
    let comparison = 0;
    if (a > b) {
      comparison = 1;
    } else if (a < b) {
      comparison = -1;
    }
    return comparison;
}

function getVariables(object: any) {
    var variablesArray = [];
    for (let variable of object.Items) {
        variablesArray.push('\t\t🛒 "' + variable.Name + '" [' + variable.Index + '] - Expression: `' + variable.EvaluationStrategy.Expression +'`');
    }

    variablesArray.sort(compare);
    variablesArray.unshift('\t === VARIABLES');

    return variablesArray.join('\n');
}

function outputContent(content: string) {
    const newFile: any = vscode.Uri.parse('untitled:' + path.join(vscode.workspace.rootPath, 'untitled.ts'));
    vscode.window.showTextDocument(newFile, vscode.ViewColumn.One, false).then(document => {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(newFile, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(9999, 9999)), content);
        edit.get(newFile);
        return vscode.workspace.applyEdit(edit);
    });
}

function migrationPreview(onlyMetrics: Boolean, allMetrics?: Boolean, protoPath?: String) {

    try {
        var migrationPreview = "";
        var regexName = new RegExp(/(.*prototypes\\)/);
        var regexPath = new RegExp(/(.*gsx.skets\\)/);
        var regVersion = new RegExp(/(prototypeVersions\[.+\])/);
        var documentPath = vscode.window.activeTextEditor.document.fileName;
        var fileName: any = regexName[Symbol.split](documentPath);
        fileName = fileName[2].slice(0, (fileName[2].length) - 3);
        var gsxSkePath: any = regexPath[Symbol.split](documentPath);
        gsxSkePath = gsxSkePath[1];
    } catch (error) {
        vscode.window.showErrorMessage("File is not in the gsx.skets repository");
        return;
    }


    if (allMetrics && protoPath) {
        var protoInfo = fs.readFileSync(protoPath);
    } else {
        try {
            var protoInfo = fs.readFileSync(gsxSkePath + 'dist\\' + fileName + '.json', 'utf8');
        } catch (error) {
            vscode.window.showErrorMessage("No JSON file found for this Prototype. You should generate the JSON.");
        }
    }
    protoInfo = JSON.parse(protoInfo);
    var protoName = protoInfo.Name;
    migrationPreview += 'PROTOTYPE: ' + protoName;

    function getScanConfig() {

        var parallelScan = protoInfo.ScanConfig && protoInfo.ScanConfig.NumberOfParallelScan ? "\n\t\tNumber of Parallel Scan: " + protoInfo.ScanConfig.NumberOfParallelScan : '';
        var scanInterval = protoInfo.ScanConfig.SchedulerStrategy && protoInfo.ScanConfig.SchedulerStrategy.ScanIntervalExpression ? "\n\t\tScan Interval Expression: `" + protoInfo.ScanConfig.SchedulerStrategy.ScanIntervalExpression + "`" : '';

        parallelScan || scanInterval ? migrationPreview += "\n\n\n\t=== SCAN CONFIG" + parallelScan + scanInterval : '';


    }

    function getFieldsToProcess(fieldsToProcess: any) {
        var fieldsArray = [];

        for (var i = 0; i < fieldsToProcess.length; i++) {
            var field = fieldsToProcess[i].Field,
                fieldIndex = i,
                fieldType = fieldsToProcess[i].FieldType,
                fieldString;

                switch (fieldType) {
                    case 0:
                        fieldType = 'Double';
                        break;
                    case 1:
                        fieldType = 'String';
                        break;
                    case 2:
                        fieldType = 'Datetime';
                        break;
                }

                fieldString = '\t\t\t\t\t\t\tField [' + fieldIndex + ']: "' + field + '" - Type: ' + fieldType;
                fieldsArray.push(fieldString);
        }
        var fieldsString = fieldsArray.join('\n');
        return fieldsString;
    }

    function getCommands(scanComponent: any) {

        var commands = [];
        if (scanComponent.Commands || scanComponent.Oids) {

            var scanComponentCommands = scanComponent.Commands ? scanComponent.Commands.Items : scanComponent.Oids.Items;

            for (var i = 0; i < scanComponentCommands.length; i++) {

                var currentCommand = scanComponentCommands[i],
                    index = currentCommand.Index,
                    command,
                    commandString;

                if (currentCommand.FieldsToProcess) {

                    command = currentCommand.Command;
                    commandString = '\t\t\t\t\t\tCommand [' + index + ']: `' + command + '`';

                    if (currentCommand.FieldsToProcess.length > 0) {
                        var fieldsToProcessString = getFieldsToProcess(currentCommand.FieldsToProcess);
                        commandString += '\n' + fieldsToProcessString;
                    }

                } else if (currentCommand.PerfCounter) {
                    command = currentCommand.PerfCounter;
                    commandString = '\t\t\t\t\t\tPerfCounter [' + index + ']: `' + command + '`';

                } else if (currentCommand.OidElements) {
                    var commandName = currentCommand.Name,
                        commandOid = currentCommand.Oid,
                        commandAlias = currentCommand.OidElements['0'].Alias;

                    command = currentCommand.OidElements;
                    commandString = '\t\t\t\t\t\tRequest [' + index + ']: `' + commandAlias + '`';

                }
                commands.push(commandString);

            }

        } else if (scanComponent.WindowsServicesList) {
            var windowsServicesList = scanComponent.WindowsServicesList;
            for (var i = 0; i < windowsServicesList.length; i++) {

                var currentWindowsService = windowsServicesList[i],
                    commandString;
                commandString = '\t\t\t\t\t\tWindows Service [' + i + ']: `' + currentWindowsService + '`';

                commands.push(commandString);

            }

        } else if (scanComponent.Queries) {
            var sqlQueriesList = scanComponent.Queries.Items;
            for (var i = 0; i < sqlQueriesList.length; i++) {

                var currentQueryObject = sqlQueriesList[i],
                    currentQueryAlias = currentQueryObject.Alias,
                    currentQuery = currentQueryObject.Query,
                    commandString;
                commandString = '\t\t\t\t\t\tSQL Query [' + i + ']: `' + currentQuery + '` - Alias: `' + currentQueryAlias + '`';

                commands.push(commandString);
            }
        }

        var commandsString = commands.join('\n');
        return commandsString;

    }

    function getScanComponents(serviceObject: any, serviceIndex: any) {

        var scanComponentsAndCommands = [];
        for (var i = 0; i < serviceObject.Items.length; i++) {

            function getScanStrategy(scanComponent: any) {

                let output;

                if (scanComponent.ScanEnabledStrategy && scanComponent.ScanEnabledStrategy.Condition) {
                    output = scanComponent.ScanEnabledStrategy.Condition;
                } else {
                    output = '⛔ No ToBeScannedIf used';
                }

                return output;

            }

            var scanComponentArray = [],
                scanComponent = serviceObject.Items[i],
                scanComponentIndex = scanComponent.Index,
                scanComponentCaption = scanComponent.Caption,
                scanComponentVariableName = scanComponent.VariableName,
                scanComponentStrategy = getScanStrategy(scanComponent),
                scanComponentString = '\n\t\t\t\t\t📡 Scan Component: `' + scanComponentCaption + '` - Index: \"EntityScanResult.ServiceScanResults[' + serviceIndex + '].ScanComponentResults[' + scanComponentIndex + ']\"  - VariableName: `' + scanComponentVariableName + '`' + ' - ToBeScannedIf: `' + scanComponentStrategy + '`',
                commandsString = getCommands(scanComponent),
                scanComponentDetails = scanComponentString + '\n' + commandsString;

            scanComponentsAndCommands.push(scanComponentDetails);


        }
        var scanComponentsAndCommandsString = scanComponentsAndCommands.join('\n');
        return scanComponentsAndCommandsString;
    }

    function getScanComponentsAndCommands(element: any, property: any) {

        if (element[property]) {
            var ar:Array<string> = [];
            var prop = property;
            var value = element[property];
            var commands;
            var commandsArray = [];
            var isPerfCounter;
            var test;
            var index;
            var commandString;
            var fields;
            var fieldsString;
            var fieldsArray;
            var commandsString;
            var str;

            var scanComponents: string;

            scanComponents = getScanComponents(element[property], element.Index);
        }
        return scanComponents;
    }

    function getTest(element: any, property: any) {

        if (element[property]) {
            var ar:Array<string> = [];
            var prop = property;
            var value: Object = element[property];
            var commands;
            var commandsArray = [];
            var test;
            var index;
            var commandString;
            var fields;
            var fieldsString;
            var fieldsArray;
            var commandsString;
            var str;

            var tests: string;

            function getTests(serviceObject: any, serviceIndex: any) {

                        var testsArray = [];
                        for (var i = 0; i < serviceObject.Items.length; i++) {

                            var test = serviceObject.Items[i],
                                testIndex = test.Index,
                                testCaption = test.Caption,
                                testVariableName = test.VariableName,
                                testStatusExpression = test.StatusStrategy && test.StatusStrategy.StatusExpression ? test.StatusStrategy.StatusExpression : null,
                                testStatusExpressionMessage = testStatusExpression !== null ? ' - Strategy: `' + testStatusExpression.replace(/\s+/gm, " ") + '`' : '',
                                testShortMessageExpression = ' - Short Message: `' + test.StatusStrategy.ShortMessageExpression.replace(/\s+/gm, " ") + '`',
                                testDetails = '\n\t\t\t\t\t🔎 Test: `' +
                                    testCaption + '` - Index: \"EntityScanResult.ServiceScanResults[' + serviceIndex + '].TestScanResults[' + testIndex + ']\" - VariableName: `' + testVariableName + '`' + testStatusExpressionMessage + testShortMessageExpression;

                                testsArray.push(testDetails);


                        }
                        var testsString = testsArray.join('\n');
                        return testsString;
            }

            tests = getTests(value, element.Index);
        }
        return tests;
    }

    function getProperties(path:any, properties:any, title: string) {
        title = "\n\t=== " + title.toUpperCase();
        migrationPreview += '\n\n' + title;
        getItems(path, properties);
    }

    function getItems(path: any, property: any) {
        if (path['Items']) {
            for (var i = 0; i < path['Items'].length; i++) {
                var element = path['Items'][i];
                var values = "";
                var value;
                var key;
                var index;
                var ar = [];
                var isService = Object.getOwnPropertyNames(element).includes('ServiceVersion');
                var isMetric = Object.getOwnPropertyNames(element).includes('MetricComponentVersion');
                var isAlert = Object.getOwnPropertyNames(element).includes('AlertDefinitionVersion');
                var isParam = Object.getOwnPropertyNames(element).includes('ParameterComponentVersion');
                var isTableParam = Object.getOwnPropertyNames(element).includes('TableParameterComponentVersion');
                var isVariable = Object.getOwnPropertyNames(element).includes('VariableComponentVersion');
                var isAccumulator = isVariable && (/^acc/).test(element.Name);
                for (var j = 0; j < property.length; j++) {

                    values = '';
                    key = property[j];
                    value = element[property[j]];

                    if (value != undefined && value != null) {
                        switch (key) {
                            case 'ScanComponents':
                                if (element.ScanComponents) {
                                    values = "\n\n\t\t\t📡📡📡 SCAN COMPONENTS\n";
                                    values += getScanComponentsAndCommands(element, key);
                                    // values += getScanComponentsAndCommands(element, key) : '';
                                }
                                break;

                            case 'Tests':
                                values = "\n\n\t\t\t🔎🔎🔎 TESTS\n";
                                values += getTest(element, key);
                                break;

                            case 'EvaluationStrategy':
                                values = 'Expression: ' + '`' + element[key].Expression.replace(/\s+/gm, " ") + '`';
                                break;

                            case 'StatusStrategy':
                                var service = element[key],
                                    messageExpression = service.MessageExpression ? 'Message Expression: ' + '`' + service.MessageExpression.replace(/\s+/gm, " ") + '` ' : '',
                                    shortMessageExpression = service.ShortMessageExpression ? '- Short Message Expression: ' + '`' + service.ShortMessageExpression.replace(/\s+/gm, " ") + '` ' : '',
                                    statusExpression = service.StatusExpression ? '- Status Expression: ' + '`' + service.StatusExpression.replace(/\s+/gm, " ") + '` ' : '',
                                    values = messageExpression + shortMessageExpression + statusExpression;
                            break;

                            case 'Strategy':
                                values = 'Expression: ' + '`' + element[key].Condition.replace(/\s+/gm, " ") + '`';
                                break;

                            case 'Index':
                                if (isService) {
                                    values = 'Index: EntityScanResult.ServiceScanResults' + '[' + value + ']';
                                } else {
                                    values = 'Index: ' + '[' + value + ']';
                                }
                                break;

                            case 'ColumnDescriptions':
                                function getTableParam(element: any) {

                                    var name = 'Columns: ',
                                        tableParamArray = [],
                                        columnsList = Object.keys(element.ColumnDescriptions);
                                    tableParamArray.push(name);

                                    for (let i = 0; i < columnsList.length; i++) {
                                        var property = columnsList[i],
                                            columnInfo = element.ColumnDescriptions[property],
                                            columnName = 'Column [' + (i + 1) + ']: `' + property + '`',
                                            columnInfoType = 'Type: ',
                                            columnInfoValue = '',
                                            columnMessageExpression = '',
                                            columnValidationExpression = '',
                                            columnArray = []
                                            ;

                                        columnArray.push(columnName);

                                        if (columnInfo.DefaultValue) {
                                            var columnInfoDefValue = columnInfo.DefaultValue;
                                            columnInfoType += columnInfoDefValue['$primitiveType'].slice(7);
                                            columnInfoValue = 'Default Value: `' + columnInfoDefValue['$value'] + '`';

                                            columnArray.push(columnInfoType, columnInfoValue);

                                        } else {

                                            var type;
                                            switch (columnInfo.Type) {
                                                case 0:
                                                    type = 'String';
                                                    break;

                                                case 3:
                                                    type = 'Boolean';
                                                    break;

                                                default:
                                                    type = columnInfo.Type;
                                                    break;
                                            }

                                            columnInfoType += type;
                                        }

                                        if (columnInfo.MessageExpression) {
                                            columnMessageExpression = 'Message Expression: `' + columnInfo.MessageExpression + '`';
                                            columnArray.push(columnMessageExpression)
                                        }

                                        if (columnInfo.ValidationExpression) {
                                            columnValidationExpression = 'Validation Expression: `' + columnInfo.ValidationExpression + '`';
                                            columnArray.push(columnValidationExpression)
                                        }

                                        var columnString = columnArray.join(' - ');
                                        tableParamArray.push(columnString);


                                    }

                                    return tableParamArray.join('\n\t\t\t\t');

                                }
                                if (isTableParam) {
                                    values = getTableParam(element);
                                }
                                break;

                            case 'Type':
                                switch (value) {
                                    case 0:
                                        value = 'String';
                                        break;
                                    case 1:
                                        value = 'Double';
                                        break;
                                    case 2:
                                        value = 'Bool';
                                        break;
                                    case 3:
                                        value = 'TimeSpan';
                                        break;
                                    case 4:
                                        value = 'Table';
                                        break;
                                    default:
                                        break;
                                }

                            default:
                                if (isService) {
                                    if (key === 'Caption') {
                                        key = '\n\t\t📣 ' + key;
                                    }
                                } else if (isVariable) {
                                    if (isAccumulator) {
                                        if (key === 'Name') {
                                            key = '📚 ' + key;
                                        }
                                    } else {
                                        if (key === 'Name' && value !== changeCase.camelCase(value)) {
                                            key = '⛔ ' + key + ': (not in Camel Case)';
                                        }
                                        else if (key === 'Name') {
                                            key = '🛒 ' + key;
                                        }
                                    }

                                } else if (isMetric) {
                                    if (key === 'Name' && value !== changeCase.pascalCase(value)) {
                                        key = '⛔ ' + key + ' (not in Pascal Case)';
                                    } else if (key === 'Alias' && value !== changeCase.titleCase(value)) {
                                        key = '⛔ ' + key + ' (not in Title Case)';
                                    } else if (key === 'Name'){
                                        key = '🐘 ' + key;
                                    } else if (key === 'Type' && value === 'Table') {
                                        function getSubmetrics(element) {

                                            var submetrics = '';

                                            element.SubMetrics.Items.forEach(function (submetric, i) {

                                                switch (submetric.Type) {
                                                    case 0:
                                                        submetric.Type = "String";
                                                        break;
                                                    case 1:
                                                        submetric.Type = "Double";
                                                        break;
                                                    case 2:
                                                        submetric.Type = "Bool";
                                                        break;
                                                    case 3:
                                                        submetric.Type = "TimeSpan";
                                                        break;
                                                    case 4:
                                                        submetric.Type = "DateTime";
                                                        break;
                                                    case 5:
                                                        submetric.Type = "Blob";
                                                        break;
                                                    case 6:
                                                        submetric.Type = "Xml";
                                                        break;
                                                }
                                                var alias = '\t\t\tSubMetric: "' + submetric.Alias + '"';
                                                var name = ' - Name: "' + submetric.Name + '"';
                                                var index = ' - Index [' + i + ']';
                                                var type = ' - Type: "' + submetric.Type + '"';
                                                var unit = submetric.Unit ? ' - Unit: "' + submetric.Unit + '"' : '';
                                                var isDimension = submetric.IsDimension ? ' - IsDimension: ' + submetric.IsDimension : '';
                                                var submetricsConcat = alias + name + index + type + unit + isDimension;
                                                submetrics += submetricsConcat + '\n';

                                            });
                                            return submetrics;
                                        }

                                        var submetrics = getSubmetrics(element);

                                        values = key + ': "' + value + '"\n' + submetrics;
                                        break;
                                    }
                                } else if (isAlert) {
                                    if (key === 'Name') {
                                        key = '📫 ' + key;
                                    }
                                } else if (isParam) {
                                    if (key === 'Name') {
                                        key = '🔐 ' + key;
                                    }
                                } else if (isTableParam) {
                                    if (key === 'Name') {
                                        key = '🔐 ' + key;
                                    } else if (key === "Value") {
                                        values = '';
                                        break;
                                    }
                                }

                                values = key + ': ' + '"' + value + '"';
                                break;
                        }
                        ar.push(values);
                    }

                }
                ar = ar.filter(Boolean);
                function joinArray(array:any) {
                    var joinedArray = '';
                    for (let i = 0; i < array.length; i++) {
                        const element = array[i];
                        var isNextElementIsSection = (/^\n/).test(array[i + 1]);
                        if (isNextElementIsSection || array[i + 1] === undefined) {
                            joinedArray += element;
                        } else {
                            joinedArray += element + ' - ';
                        }

                    }
                    return joinedArray;
                }

                values = joinArray(ar);
                values = checkTestMetric(values);

                function checkTestMetric(metric: string) {
                        if (metric.indexOf("🐘") >= 0 && /.*(Test")/.test(metric) && metric.indexOf('Type: "String"') < 0 ) {
                            metric += ' ⛔️ (Type must be a String)';
                            return metric;
                        }
                    return metric;
                    }

                // values = ar.join(' - ');
                migrationPreview += '\n\t\t' + values;
            }
        }
    }

    function getWizard() {
        var protoWizardPages = protoInfo.WizardDialogs.Items[0].Pages.Items;
        migrationPreview += "\n\n\n\t=== WIZARD";
        for (var o = 0; o < protoWizardPages.length; o++) {
            var wizardPage = protoWizardPages[o];
            migrationPreview += "\n\t\t📋 Short Title Page '" + wizardPage.ShortTitle + "' - Long Title Page '" + wizardPage.ShortTitle + "' - Index: [" + wizardPage.Index + "] - Position: " + wizardPage.Position + "";
            var pageElements = wizardPage.PageElements.Items;
            pageElements = pageElements.sort(comparePosition);
            for (var p = 0; p < pageElements.length; p++) {
                var wizardPageElement = pageElements[p];
                var fragmentDescription;
                var fragmentLabel;
                var indexAndPositionDescription = " - Index: [" + wizardPageElement.Index + "] - Position: " + wizardPageElement.Position;
                var hasInfoText    = (wizardPageElement.InfoText ? " - InfoText: `" + wizardPageElement.InfoText + "`":    "");
                var hasDataModel   = (wizardPageElement.DataModel ? " - Parameter: `" + wizardPageElement.DataModel + "`": "");
                var isSection      = (/(WizardPageSection)/).test(wizardPageElement.$type);
                var isFragment     = (/(WizardPageFragment)/).test(wizardPageElement.$type);
                var isAlert        = (/Alert/).test(wizardPageElement.ViewType);
                var isButton       = wizardPageElement.JsPrototype === 'ViewOnTheFlyActions';
                var isStringField  = wizardPageElement.JsPrototype === 'ViewStringField';
                var isNumericField = wizardPageElement.JsPrototype === 'ViewNumericUpDownField';

                if (isButton) {
                    var icon = '📥 ';
                } else if (isStringField) {
                    var icon = '🅰️ ';
                } else if (isNumericField) {
                    var icon = '🔂 ';
                } else if (isAlert) {
                    var icon = '📧 ';
                } else {
                    var icon = '🔧 ';
                }


                migrationPreview += "\n\t\t\t";
                if (isSection) {
                    migrationPreview += "📂 Section: " +
                        (changeCase.titleCase(wizardPageElement.Title) === wizardPageElement.Title ? "'" : "⛔️ (not in title case) '") + wizardPageElement.Title + "'" + " - Index: [" + wizardPageElement.Index + "]" + " - Position: " + wizardPageElement.Position + hasDataModel + hasInfoText;
                }
                else {
                    fragmentDescription = sanitizeFragmentName(wizardPageElement.ViewType);
                    fragmentLabel = getFragmentLabel(wizardPageElement);
                    migrationPreview += "\t\t" + icon + fragmentDescription +
                        (fragmentLabel != '' ? ": '" + fragmentLabel + "'" : '') +
                        (wizardPageElement.DataModel && wizardPageElement.DataModel != 'Entity' ? " - Data: \"" + wizardPageElement.DataModel + "\"" : '') +
                        (wizardPageElement.Config && wizardPageElement.Config.FieldUnit ? " - Unit: '" + wizardPageElement.Config.FieldUnit + "'" : '') +
                        (wizardPageElement.Config && typeof wizardPageElement.Config.Minimum === 'number' ? " - Minimum: '" + wizardPageElement.Config.Minimum + "'" : '') +
                        (wizardPageElement.Config && wizardPageElement.Config.Maximum ? " - Maximum: '" + wizardPageElement.Config.Maximum + "'" : '') +
                        (wizardPageElement.Config && wizardPageElement.Config.FieldInfo ? " - InfoText: '" + wizardPageElement.Config.FieldInfo + "'" : '') +
                        indexAndPositionDescription;
                }
            }
        }
    }

    function outputWizard() {
        protoInfo.WizardDialogs && protoInfo.WizardDialogs.Items ? getWizard() : '';
    }

    function outputMetrics() {

        var properties = []

        if (onlyMetrics) {
            properties = ['Name', 'Type', 'Unit'];
        } else {
            properties = ['Name', 'Index', 'Alias', 'EvaluationStrategy', 'Type', 'Unit'];
        }

        protoInfo.Metrics ? getProperties(protoInfo.Metrics, properties, "Metrics") : '';

    }

    function outputAlerts() {
        protoInfo.AlertProvider ? getProperties(protoInfo.AlertProvider.AlertDefinitions, ['Name', 'Index', 'NameInAlert', 'NameNoLongerInAlert', 'RetryCount', 'Strategy'], 'Alerts') : '';
    }

    function outputParameters() {
        protoInfo.Params ? getProperties(protoInfo.Params, ['Name', 'Index', 'Value', 'ColumnDescriptions'], 'Parameters') : '';
    }

    function outputVariables() {
        protoInfo.Variables ? getProperties(protoInfo.Variables, ['Name', 'Index', 'EvaluationStrategy'], 'Variables') : '';
        var variablesString = getVariables(protoInfo.Variables);

    }

    function outputAccumulators() {
        protoInfo.AccumulatorProvider ? getProperties(protoInfo.AccumulatorProvider.Accumulators, ['Name', 'Index', 'EvaluationStrategy'], 'Accumulators') : '';
    }

    function outputServices() {
        protoInfo.Services ? getProperties(protoInfo.Services, ['Caption', 'Index', 'VariableName', 'StatusStrategy', 'ScanComponents', 'Tests'], "Services") : '';
    }

    function outputResources() {
        protoInfo.ResourceProvider && protoInfo.ResourceProvider.Resources ? getProperties(protoInfo.ResourceProvider.Resources, ['Name', 'Index', 'FileNameExpression'], 'Resources') : '';
    }

    function outputScanConfig() {
        protoInfo.ScanConfig ? getScanConfig() : '';
    }

    if (!onlyMetrics) {
        outputScanConfig();
        outputResources();
        outputServices();
        outputAccumulators();
        outputVariables();
        outputParameters();
        outputAlerts();
        outputMetrics();
        outputWizard();
    } else {
        outputMetrics();
    }

    return migrationPreview;

}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "Migration Check Tool" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json

    const terminal = vscode.window.createOutputChannel("SKE Tool");

    vscode.commands.registerCommand('extension.migrationPreview', () => {
        // The code you place here will be executed every time your command is executed
        try {
            var singlePrototypeMigrationPreview = migrationPreview(false);
            if (singlePrototypeMigrationPreview !== undefined) {
                outputContent(singlePrototypeMigrationPreview);
            }

        } catch (error) {
            vscode.window.showErrorMessage(error.message, error.stack);
        }

    });

    vscode.commands.registerCommand('extension.migrationVersionCheck', () => {
        // The code you place here will be executed every time your command is executed
        var regexName = new RegExp(/(.*prototypes\\)/);
        var regexPath = new RegExp(/(.*gsx.skets\\)/);
        var documentPath = vscode.window.activeTextEditor.document.fileName;
        var fileName: any = regexName[Symbol.split](documentPath);
        fileName = fileName[2].slice(0, (fileName[2].length) - 3);
        var gsxSkePath: any = regexPath[Symbol.split](documentPath);
        gsxSkePath = gsxSkePath[1];

        var prototypesPath = gsxSkePath + "prototypes\\";
        var prototypesList = fs.readdirSync(prototypesPath);
        prototypesList = prototypesList.filter(element => element.match(/.+\.(ts)/) && element.indexOf("Utilities") === -1);
        var prototypesArray = [];


        for (const element of prototypesList) {
            var prototypePath = prototypesPath + element;
            var prototypeName = element.slice(0, (element.length) - 3);
            var regexVersion = /prototypeVersions\[\d*\]/g;

            var prototype = fs.readFileSync(prototypePath, 'utf8');
            var versionsList = prototype.match(regexVersion);
            var latestVersion = (versionsList.pop()).match(/\d+/)[0];

            var prototypeAndVersion = prototypeName + ' [V' + latestVersion + ']';
            prototypesArray.push(prototypeAndVersion);
        }


        var prototypesAndVersions = prototypesArray.join('\n');

         const newFile: any = vscode.Uri.parse('untitled:' + path.join(vscode.workspace.rootPath, 'untitled.ts'));
            vscode.window.showTextDocument(newFile, vscode.ViewColumn.One, false).then(document => {
            const edit = new vscode.WorkspaceEdit();
            edit.insert(newFile, new vscode.Position(0, 0), prototypesAndVersions);
            edit.get(newFile);
            return vscode.workspace.applyEdit(edit)
        });

    });

    vscode.commands.registerCommand('extension.metricsCheck', () => {

        var allPrototypesMetricsPreview = '';

        var regexName = new RegExp(/(.*prototypes\\)/);
        var regexPath = new RegExp(/(.*gsx.skets\\)/);
        var documentPath = vscode.window.activeTextEditor.document.fileName;
        var fileName: any = regexName[Symbol.split](documentPath);
        fileName = fileName[2].slice(0, (fileName[2].length) - 3);
        var gsxSkePath: any = regexPath[Symbol.split](documentPath);
        gsxSkePath = gsxSkePath[1];

        var prototypesPath = gsxSkePath + "dist\\";
        var prototypesList = fs.readdirSync(prototypesPath);
        var prototypesArray = [];


        prototypesList.forEach(function(element){
            if (element.match(/.+\.(json)/) && !element.match(/.+(Manager)/)) {

                var prototypePath = prototypesPath + element;
                var prototypeMetrics = migrationPreview(true, true, prototypePath);
                allPrototypesMetricsPreview += prototypeMetrics + '\n\n\n';

                }
            });

        outputContent(allPrototypesMetricsPreview);

    });

    let disposable = vscode.commands.registerCommand('extension.generateSignedJsFiles', () => {

        var regexName = new RegExp(/(.*prototypes\\)/);
        var regexPath = new RegExp(/(.*gsx.skets\\)/);
        var documentPath = vscode.window.activeTextEditor.document.fileName;
        var fileName: any = regexName[Symbol.split](documentPath);
        // fileName = fileName[2].slice(0, (fileName[2].length) - 3);
        var prototype = fs.readFileSync(documentPath, 'utf8');
        prototype = prototype.match(/(entity.Name).*/);
        prototype = prototype[0].split(/.*\s*=\s*"/)[1];
        prototype = prototype.substring(0, prototype.length - 2);

        fileName = prototype;

        var fileNamePowerShellArg = fileName.replace(/\s/g, "_");
        fileNamePowerShellArg = '\"' + fileNamePowerShellArg + '\"';
        var gsxSkePath: any = regexPath[Symbol.split](documentPath);
        gsxSkePath = gsxSkePath[1];
        var skeCompile = gsxSkePath + "ske-compile.ps1";



        terminal.clear();

        var spawn = require("child_process").spawn,
            child;
        child = spawn("powershell.exe",[ skeCompile, "-CURRENT_PROTOTYPE", fileNamePowerShellArg ]);
        child.stdout.on("data",function(data){
            console.log("" + data);
            data === "" ? '' : terminal.appendLine("" + data);
            terminal.show();

        });
        child.stderr.on("data",function(data){
            data === "" ? '' : console.log("Powershell Error: " + data);
            vscode.window.showErrorMessage("Powershell Error: " + data);
        });
        child.on("exit",function(){
            console.log("Powershell Script finished");
        });
        child.stdin.end(); //end input

    });

    context.subscriptions.push(disposable);

}
// this method is called when your extension is deactivated
export function deactivate() {
}