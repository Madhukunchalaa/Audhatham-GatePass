sap.ui.define([
	"sap/ui/core/UIComponent",
	"./model/models",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel"
], function (UIComponent, models, Device, JSONModel) {
	"use strict";

	return UIComponent.extend("zaudgpms.audhatham.com.Component", {
		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		init: function () {
			UIComponent.prototype.init.apply(this, arguments);

			this.setModel(models.createDeviceModel(), "device");

			this.getRouter().initialize();
			this._authenticateUser();
		},

		getContentDensityClass: function () {
			if (!this._sContentDensityClass) {
				if (!Device.support.touch) {
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},

		_authenticateUser: function () {
			var oODataModel = this.getModel();
			if (!oODataModel) {
				this._triggerUserUpdateEvent();
				return;
			}
			oODataModel.metadataLoaded().then(function () {
				this._loadUserDetails();
			}.bind(this)).catch(function () {
				var oUserModel = new JSONModel({ id: "", fullName: "", Plant: "", Cocode: "", Department: "" });
				sap.ui.getCore().setModel(oUserModel, "user");
				this.setModel(oUserModel, "user");
				this._triggerUserUpdateEvent();
			}.bind(this));
		},

		_loadUserDetails: function () {
			var that = this;
			var oODataModel = this.getModel();

			var fnApply = function (oRecord) {
				var oUserModel = new JSONModel({
					id:         oRecord.User       || "",
					fullName:   oRecord.FullName   || oRecord.User || "",
					Plant:      oRecord.Plant      || "",
					Cocode:     oRecord.Cocode     || "",
					Department: oRecord.Department || ""
				});
				sap.ui.getCore().setModel(oUserModel, "user");
				that.setModel(oUserModel, "user");
				that._triggerUserUpdateEvent();
			};

			oODataModel.read("/ZUserdetSet", {
				success: function (oData) { fnApply((oData.results && oData.results[0]) || {}); },
				error:   function ()       { fnApply({}); }
			});
		},

		_triggerUserUpdateEvent: function () {
			sap.ui.getCore().getEventBus().publish("UserChannel", "UserUpdated");
		}
	});
});
