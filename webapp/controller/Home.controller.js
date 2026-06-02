sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("zaudgpms.audhatham.com.controller.Home", {

		onInit: function () {
		},

		onPressCreateGatePass: function () {
			this.getRouter().navTo("GatePassCreation");
		},

		onPressGatePassList: function () {
			this.getRouter().navTo("GatePassList");
		}

	});
});
