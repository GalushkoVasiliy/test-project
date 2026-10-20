using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using static Rentals.UnitTests.TestData;

namespace Rentals.UnitTests.Domain;

public class CoApplicantTests
{
    [Fact]
    public void A_co_applicant_has_the_same_rights_as_the_primary_applicant()
    {
        var application = Draft();
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);

        Assert.True(application.CanBeEditedBy(OtherApplicant.Id));
        application.SaveApplicantInfo(OtherApplicant, Info(), 0, Now);
        application.SaveResidences(OtherApplicant, [Residence()], 0, Now);
        application.Submit(OtherApplicant, Today, Now);

        Assert.Equal(ApplicationStatus.Submitted, application.Status);
        Assert.True(application.CanBeWithdrawnBy(OtherApplicant.Id));
    }

    [Fact]
    public void Two_applicants_saving_different_sections_do_not_interfere()
    {
        var application = Draft();
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);

        // Both started from the same snapshot (all section versions 0).
        application.SaveApplicantInfo(Applicant, Info(), basedOnVersion: 0, Now);
        application.SaveResidences(OtherApplicant, [Residence()], basedOnVersion: 0, Now);

        Assert.True(application.AllSectionsSaved);
    }

    [Fact]
    public void The_second_of_two_saves_to_the_same_section_is_rejected_as_stale()
    {
        var application = Draft();
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);
        application.SaveApplicantInfo(Applicant, Info(), basedOnVersion: 0, Now);

        var error = Assert.Throws<DomainException>(() =>
            application.SaveApplicantInfo(OtherApplicant, Info() with { Phone = "(555) 000-0000" }, basedOnVersion: 0, Now));

        Assert.Equal("stale_section", error.Code);
        Assert.Equal("(555) 123-4567", application.ApplicantInfo.Phone);
    }

    [Fact]
    public void Someone_who_is_not_on_the_application_cannot_change_it()
    {
        var application = Draft();

        var error = Assert.Throws<DomainException>(() => application.SaveApplicantInfo(OtherApplicant, Info(), 0, Now));

        Assert.Equal("not_an_applicant", error.Code);
    }

    [Fact]
    public void Adding_the_same_person_twice_is_a_no_op()
    {
        var application = Draft();

        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);
        application.AddCoApplicant(Applicant, Applicant.Id, Now);

        Assert.Single(application.CoApplicants);
    }

    [Fact]
    public void The_number_of_applicants_is_limited()
    {
        var application = Draft();
        for (var i = 1; i < RentalApplication.MaxApplicants; i++)
        {
            application.AddCoApplicant(Applicant, $"co-{i}", Now);
        }

        var error = Assert.Throws<DomainException>(() => application.AddCoApplicant(Applicant, "one-too-many", Now));

        Assert.Equal("too_many_applicants", error.Code);
    }

    [Fact]
    public void The_primary_applicant_can_remove_a_co_applicant_and_a_co_applicant_can_leave()
    {
        var application = Draft();
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);
        application.AddCoApplicant(Applicant, "third", Now);

        application.RemoveCoApplicant(Applicant, "third", Now);
        application.RemoveCoApplicant(OtherApplicant, OtherApplicant.Id, Now);

        Assert.Empty(application.CoApplicants);
        Assert.False(application.HasApplicant(OtherApplicant.Id));
    }

    [Fact]
    public void A_co_applicant_cannot_remove_others_and_nobody_can_remove_the_primary_applicant()
    {
        var application = Draft();
        application.AddCoApplicant(Applicant, OtherApplicant.Id, Now);
        application.AddCoApplicant(Applicant, "third", Now);

        var removeOther = Assert.Throws<DomainException>(() => application.RemoveCoApplicant(OtherApplicant, "third", Now));
        var removePrimary = Assert.Throws<DomainException>(() => application.RemoveCoApplicant(OtherApplicant, Applicant.Id, Now));

        Assert.Equal("cannot_remove_applicant", removeOther.Code);
        Assert.Equal("cannot_remove_primary_applicant", removePrimary.Code);
    }

    [Fact]
    public void Applicants_cannot_be_changed_once_the_application_is_submitted()
    {
        var application = Submitted();

        var error = Assert.Throws<DomainException>(() => application.AddCoApplicant(Applicant, OtherApplicant.Id, Now));

        Assert.Equal("application_not_editable", error.Code);
    }

    [Fact]
    public void A_section_can_be_saved_as_an_incomplete_draft()
    {
        var application = Draft();

        application.SaveApplicantInfo(Applicant, new ApplicantInfo("  Alex  ", "  ", null, null), 0, Now);
        application.SaveResidences(Applicant, [new ResidenceData(Guid.NewGuid(), "1 Main St", null, null, null, null)], 0, Now);

        Assert.Equal("Alex", application.ApplicantInfo.FullName);
        Assert.Null(application.ApplicantInfo.Phone);
        Assert.Null(Assert.Single(application.Residences).MoveInDate);
        Assert.True(application.AllSectionsSaved);
    }
}
