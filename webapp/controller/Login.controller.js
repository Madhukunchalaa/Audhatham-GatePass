sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, Filter, FilterOperator) {
    "use strict";

    return BaseController.extend("zaudgpms.audhatham.com.controller.Login", {

        onInit: function () {
            this._authenticate();
        },

        /**
         * Authenticates against the Audhatham SAP system.
         * The browser handles the basic auth popup automatically when the
         * OData model makes its first request.
         * We ping the metadata endpoint to trigger auth, then load user details.
         */
        _authenticate: function () {
            var oODataModel = this.getOwnerComponent().getModel();

            // Ping the OData metadata to trigger SAP basic auth popup.
            // Once the user enters credentials, the session is established.
            oODataModel.metadataLoaded().then(function () {
                console.log("[Login] Metadata loaded - SAP session established.");
                this._loadUserDetails();
            }.bind(this)).catch(function (oError) {
                console.error("[Login] Metadata load failed:", oError);
                MessageBox.error(
                    "Unable to connect to the Audhatham SAP system.\nPlease check your network connection and try again.",
                    { title: "Connection Failed" }
                );
            });
        },

        /**
         * Loads user details from ZUserdetSet using current SAP session.
         * The entity returns the logged-in user's Plant, Company Code, and Department.
         */
        _loadUserDetails: function () {
            var fnNavigate = function () {
                this.getRouter().navTo("home");
            }.bind(this);

            // Removed ZUserdetSet call and static user details as requested.
            var oUserModel = new JSONModel({
                id:         "",
                fullName:   "",
                Plant:      "",
                Cocode:     "",
                Department: ""
            });

            sap.ui.getCore().setModel(oUserModel, "user");
            fnNavigate();
        }

    });
});
